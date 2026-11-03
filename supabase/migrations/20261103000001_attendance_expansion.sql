-- ============================================================================
-- Light Nation Church Attendance Management System
-- Migration 0002 — Attendance Analytics, Dynamic Registration Forms and
--                  Dual QR Access (GPS-verified + Protocol-verified)
-- ============================================================================
-- This migration EXTENDS the initial schema (20261101000001_initial_schema.sql).
-- The initial migration is NOT modified. All statements are written to be
-- idempotent where practical so the file can be safely re-applied.
--
-- Summary of changes
--   1. Internal helpers (secure random tokens, distance, default form schema).
--   2. New "protocol" role + staff/protocol permission helpers.
--   3. Organization geofence configuration (church coordinates, radius, accuracy).
--   4. Session type, session timezone, absolute opens_at / closes_at,
--      per-session form schema (versioned) and optional geofence overrides.
--   5. Persistent, revocable QR access tokens (general + protocol per session).
--   6. Attendance record verification method, protocol attribution,
--      custom form responses (with label snapshots) and GPS audit metadata.
--   7. Form-version history and attendance audit log.
--   8. Server-side validators (form schema, form responses, departments, GPS).
--   9. Public GPS registration RPCs and authenticated Protocol RPCs.
--  10. Token revoke/regenerate RPC.
--  11. Attendance analytics RPC.
--  12. Tightened RLS (protocol members cannot manage data; records can only be
--      inserted through validated RPCs) and Realtime publication.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Internal helpers
-- ----------------------------------------------------------------------------

-- Cryptographically secure random token (gen_random_uuid uses a CSPRNG).
-- 40 hex characters (~154 random bits) plus a short type prefix.
create or replace function public.ln_random_token(p_prefix text)
returns text
language sql
volatile
set search_path = public
as $$
  select p_prefix || substr(
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
    1,
    40
  );
$$;

-- Great-circle distance in metres (haversine).
create or replace function public.ln_distance_m(
  p_lat1 double precision,
  p_lng1 double precision,
  p_lat2 double precision,
  p_lng2 double precision
)
returns double precision
language sql
immutable
set search_path = public
as $$
  select 2 * 6371008.8 * asin(least(1.0, sqrt(
    power(sin(radians(p_lat2 - p_lat1) / 2), 2)
    + cos(radians(p_lat1)) * cos(radians(p_lat2)) * power(sin(radians(p_lng2 - p_lng1) / 2), 2)
  )));
$$;

-- Default (Sunday Service) registration form: Full Name + Department.
create or replace function public.ln_default_form_schema()
returns jsonb
language sql
immutable
set search_path = public
as $$
  select jsonb_build_object(
    'fields', jsonb_build_array(
      jsonb_build_object('id', 'full_name', 'type', 'full_name', 'label', 'Full Name', 'helpText', '', 'required', true),
      jsonb_build_object('id', 'department', 'type', 'department', 'label', 'Department', 'helpText', '', 'required', true)
    )
  );
$$;

-- ----------------------------------------------------------------------------
-- 2. Staff permission helper
-- ----------------------------------------------------------------------------

-- Staff = members who manage sessions, records, forms and analytics.
create or replace function public.current_user_is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_profiles
    where id = auth.uid()
      and is_active = true
      and role in ('super_admin', 'admin', 'coordinator')
  );
$$;

grant execute on function public.current_user_is_staff() to authenticated;

-- ----------------------------------------------------------------------------
-- 3. Organization geofence configuration
-- ----------------------------------------------------------------------------

alter table public.organizations
  add column if not exists geofence_latitude double precision,
  add column if not exists geofence_longitude double precision,
  add column if not exists geofence_radius_m integer not null default 100,
  add column if not exists gps_accuracy_threshold_m integer not null default 50;

alter table public.organizations drop constraint if exists organizations_geofence_latitude_check;
alter table public.organizations
  add constraint organizations_geofence_latitude_check
  check (geofence_latitude is null or (geofence_latitude between -90 and 90));

alter table public.organizations drop constraint if exists organizations_geofence_longitude_check;
alter table public.organizations
  add constraint organizations_geofence_longitude_check
  check (geofence_longitude is null or (geofence_longitude between -180 and 180));

alter table public.organizations drop constraint if exists organizations_geofence_radius_check;
alter table public.organizations
  add constraint organizations_geofence_radius_check
  check (geofence_radius_m between 20 and 5000);

alter table public.organizations drop constraint if exists organizations_gps_accuracy_check;
alter table public.organizations
  add constraint organizations_gps_accuracy_check
  check (gps_accuracy_threshold_m between 5 and 1000);

-- ----------------------------------------------------------------------------
-- 4. Session type, absolute window, form schema and geofence overrides
-- ----------------------------------------------------------------------------

alter table public.attendance_sessions
  add column if not exists session_type text not null default 'general_event',
  add column if not exists timezone text,
  add column if not exists opens_at timestamptz,
  add column if not exists closes_at timestamptz,
  add column if not exists form_schema jsonb,
  add column if not exists form_version integer not null default 1,
  add column if not exists geofence_latitude double precision,
  add column if not exists geofence_longitude double precision,
  add column if not exists geofence_radius_m integer,
  add column if not exists gps_accuracy_threshold_m integer;

alter table public.attendance_sessions drop constraint if exists attendance_sessions_session_type_check;
alter table public.attendance_sessions
  add constraint attendance_sessions_session_type_check
  check (session_type in ('sunday_service', 'workers_meeting', 'conference', 'general_event', 'custom'));

alter table public.attendance_sessions drop constraint if exists attendance_sessions_geofence_check;
alter table public.attendance_sessions
  add constraint attendance_sessions_geofence_check
  check (
    (geofence_latitude is null or geofence_latitude between -90 and 90)
    and (geofence_longitude is null or geofence_longitude between -180 and 180)
    and ((geofence_latitude is null) = (geofence_longitude is null))
    and (geofence_radius_m is null or geofence_radius_m between 20 and 5000)
    and (gps_accuracy_threshold_m is null or gps_accuracy_threshold_m between 5 and 1000)
  );

-- Backfill existing sessions (best-effort classification of legacy sessions).
update public.attendance_sessions s
set
  session_type = case
    when s.title ilike '%conference%' or s.category ilike '%conference%' then 'conference'
    when s.title ilike '%worker%' or s.category ilike '%worker%' then 'workers_meeting'
    when s.title ilike '%sunday%' or extract(dow from s.session_date) = 0 then 'sunday_service'
    else 'general_event'
  end,
  timezone = coalesce(s.timezone, o.timezone, 'Africa/Lagos'),
  form_schema = coalesce(s.form_schema, public.ln_default_form_schema())
from public.organizations o
where o.id = s.organization_id
  and (s.timezone is null or s.form_schema is null);

update public.attendance_sessions
set
  opens_at = (session_date + start_time) at time zone timezone,
  closes_at = (session_date + end_time) at time zone timezone
where opens_at is null or closes_at is null;

alter table public.attendance_sessions alter column timezone set not null;
alter table public.attendance_sessions alter column opens_at set not null;
alter table public.attendance_sessions alter column closes_at set not null;
alter table public.attendance_sessions alter column form_schema set not null;
alter table public.attendance_sessions alter column form_schema set default public.ln_default_form_schema();

create index if not exists idx_sessions_org_type_date
  on public.attendance_sessions(organization_id, session_type, session_date desc);
create index if not exists idx_sessions_window
  on public.attendance_sessions(organization_id, opens_at, closes_at);

-- ----------------------------------------------------------------------------
-- 5. Persistent, revocable QR access tokens
-- ----------------------------------------------------------------------------

create table if not exists public.session_access_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  access_type text not null check (access_type in ('general', 'protocol')),
  token text not null unique check (token = lower(token) and char_length(token) between 12 and 80),
  created_by uuid references public.admin_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.admin_profiles(id) on delete set null,
  revoke_reason text not null default ''
);

create unique index if not exists ux_session_access_tokens_active
  on public.session_access_tokens(session_id, access_type)
  where revoked_at is null;
create index if not exists idx_session_access_tokens_session
  on public.session_access_tokens(session_id);

-- Backfill: the existing qr_token becomes the General Attendance token so that
-- already-shared QR codes keep working; a new Protocol token is generated.
insert into public.session_access_tokens (organization_id, session_id, access_type, token, created_by)
select s.organization_id, s.id, 'general', lower(s.qr_token), s.created_by
from public.attendance_sessions s
where not exists (
  select 1 from public.session_access_tokens t
  where t.session_id = s.id and t.access_type = 'general'
);

insert into public.session_access_tokens (organization_id, session_id, access_type, token, created_by)
select s.organization_id, s.id, 'protocol', public.ln_random_token('p_'), s.created_by
from public.attendance_sessions s
where not exists (
  select 1 from public.session_access_tokens t
  where t.session_id = s.id and t.access_type = 'protocol'
);

-- ----------------------------------------------------------------------------
-- 6. Attendance record verification, attribution and custom responses
-- ----------------------------------------------------------------------------

alter table public.attendance_records
  add column if not exists verification_method text not null default 'legacy_unverified',
  add column if not exists registered_by uuid references public.admin_profiles(id) on delete set null,
  add column if not exists registered_by_name text,
  add column if not exists access_token_id uuid references public.session_access_tokens(id) on delete set null,
  add column if not exists responses jsonb not null default '{}'::jsonb,
  add column if not exists form_version integer,
  add column if not exists gps_distance_m integer,
  add column if not exists gps_accuracy_m integer,
  -- Reserved for a future member directory (no FK yet by design).
  add column if not exists member_id uuid;

alter table public.attendance_records drop constraint if exists attendance_records_verification_method_check;
alter table public.attendance_records
  add constraint attendance_records_verification_method_check
  check (verification_method in ('gps_verified', 'protocol_verified', 'admin_manual', 'legacy_unverified'));

alter table public.attendance_records drop constraint if exists attendance_records_source_check;
alter table public.attendance_records
  add constraint attendance_records_source_check
  check (source in ('qr-web', 'admin-manual', 'protocol'));

create index if not exists idx_records_org_method on public.attendance_records(organization_id, verification_method);
create index if not exists idx_records_registered_by on public.attendance_records(registered_by);
create index if not exists idx_records_member on public.attendance_records(member_id) where member_id is not null;

-- ----------------------------------------------------------------------------
-- 7. Form version history and attendance audit log
-- ----------------------------------------------------------------------------

create table if not exists public.session_form_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  version integer not null,
  form_schema jsonb not null,
  created_by uuid references public.admin_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (session_id, version)
);

insert into public.session_form_versions (organization_id, session_id, version, form_schema, created_by)
select s.organization_id, s.id, s.form_version, s.form_schema, s.created_by
from public.attendance_sessions s
on conflict (session_id, version) do nothing;

create table if not exists public.attendance_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  session_id uuid references public.attendance_sessions(id) on delete set null,
  actor_id uuid references public.admin_profiles(id) on delete set null,
  actor_name text not null default '',
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_attendance_audit_logs_org
  on public.attendance_audit_logs(organization_id, created_at desc);
create index if not exists idx_attendance_audit_logs_session
  on public.attendance_audit_logs(session_id, created_at desc);

create or replace function public.ln_log_action(
  p_organization_id uuid,
  p_session_id uuid,
  p_action text,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_name text := '';
begin
  if auth.uid() is not null then
    select full_name into v_actor_name from public.admin_profiles where id = auth.uid();
  end if;

  insert into public.attendance_audit_logs (organization_id, session_id, actor_id, actor_name, action, details)
  values (
    p_organization_id,
    p_session_id,
    case when exists (select 1 from public.admin_profiles where id = auth.uid()) then auth.uid() end,
    coalesce(v_actor_name, ''),
    p_action,
    coalesce(p_details, '{}'::jsonb)
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 8. Server-side validators
-- ----------------------------------------------------------------------------

-- 8.1 Registration form schema validation (raises on invalid configuration)
create or replace function public.ln_validate_form_schema(p_schema jsonb)
returns void
language plpgsql
stable
set search_path = public
as $$
declare
  v_field jsonb;
  v_ids text[] := '{}';
  v_id text;
  v_type text;
  v_label text;
  v_opts jsonb;
  v_opt jsonb;
  v_opt_values text[];
  v_full_name_count integer := 0;
  v_dept_count integer := 0;
  v_count integer;
begin
  if p_schema is null
    or jsonb_typeof(p_schema) <> 'object'
    or jsonb_typeof(p_schema -> 'fields') is distinct from 'array' then
    raise exception 'Registration form configuration is invalid.';
  end if;

  v_count := jsonb_array_length(p_schema -> 'fields');
  if v_count < 1 or v_count > 40 then
    raise exception 'A registration form must contain between 1 and 40 fields.';
  end if;

  for v_field in select value from jsonb_array_elements(p_schema -> 'fields') loop
    if jsonb_typeof(v_field) <> 'object' then
      raise exception 'Registration form configuration is invalid.';
    end if;

    v_id := v_field ->> 'id';
    v_type := v_field ->> 'type';
    v_label := trim(coalesce(v_field ->> 'label', ''));

    if v_id is null or v_id !~ '^[a-z][a-z0-9_]{0,47}$' then
      raise exception 'Form field identifiers must start with a letter and contain only lowercase letters, numbers or underscores.';
    end if;

    if v_id = any(v_ids) then
      raise exception 'Duplicate form field identifier: %', v_id;
    end if;
    v_ids := array_append(v_ids, v_id);

    if v_type is null or v_type not in (
      'full_name', 'department', 'short_text', 'email', 'phone', 'number', 'select', 'radio', 'checkbox', 'yes_no'
    ) then
      raise exception 'Unsupported form field type: %', coalesce(v_type, '(missing)');
    end if;

    if char_length(v_label) < 1 or char_length(v_label) > 120 then
      raise exception 'Every form field needs a label of at most 120 characters.';
    end if;

    if char_length(coalesce(v_field ->> 'helpText', '')) > 300 then
      raise exception 'Helper text for "%" must be at most 300 characters.', v_label;
    end if;

    if v_field ? 'required' and jsonb_typeof(v_field -> 'required') <> 'boolean' then
      raise exception 'The "required" setting for "%" must be true or false.', v_label;
    end if;

    if v_type = 'full_name' then
      v_full_name_count := v_full_name_count + 1;
      if v_id <> 'full_name' then
        raise exception 'The Full Name field must use the identifier "full_name".';
      end if;
    elsif v_type = 'department' then
      v_dept_count := v_dept_count + 1;
      if v_id <> 'department' then
        raise exception 'The Department field must use the identifier "department".';
      end if;
    elsif v_id in ('full_name', 'department') then
      raise exception 'The identifier "%" is reserved.', v_id;
    end if;

    if v_type in ('select', 'radio', 'checkbox') then
      v_opts := v_field -> 'options';
      if v_opts is null
        or jsonb_typeof(v_opts) <> 'array'
        or jsonb_array_length(v_opts) < 1
        or jsonb_array_length(v_opts) > 50 then
        raise exception 'The field "%" needs between 1 and 50 options.', v_label;
      end if;

      v_opt_values := '{}';
      for v_opt in select value from jsonb_array_elements(v_opts) loop
        if jsonb_typeof(v_opt) <> 'string'
          or char_length(trim(v_opt #>> '{}')) < 1
          or char_length(v_opt #>> '{}') > 120 then
          raise exception 'Options for "%" must be non-empty text of at most 120 characters.', v_label;
        end if;
        if lower(trim(v_opt #>> '{}')) = any(v_opt_values) then
          raise exception 'The field "%" contains duplicate options.', v_label;
        end if;
        v_opt_values := array_append(v_opt_values, lower(trim(v_opt #>> '{}')));
      end loop;
    end if;
  end loop;

  if v_full_name_count <> 1 then
    raise exception 'Every registration form must include the Full Name field.';
  end if;

  if v_dept_count > 1 then
    raise exception 'A registration form can only include one Department field.';
  end if;
end;
$$;

-- 8.2 Custom response validation. Returns a normalized snapshot:
--     { "<field_id>": { "label": "...", "type": "...", "value": <value> } }
--     Rejects keys that are not custom fields of the session's form.
create or replace function public.ln_validate_form_responses(p_schema jsonb, p_responses jsonb)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_responses jsonb := coalesce(p_responses, '{}'::jsonb);
  v_key text;
  v_field jsonb;
  v_type text;
  v_label text;
  v_required boolean;
  v_raw jsonb;
  v_text text;
  v_num numeric;
  v_arr jsonb;
  v_item jsonb;
  v_clean jsonb;
  v_result jsonb := '{}'::jsonb;
  v_custom_ids text[];
begin
  if jsonb_typeof(v_responses) <> 'object' then
    raise exception 'Form responses must be submitted as an object.';
  end if;

  select coalesce(array_agg(f ->> 'id'), '{}')
  into v_custom_ids
  from jsonb_array_elements(p_schema -> 'fields') f
  where f ->> 'type' not in ('full_name', 'department');

  for v_key in select jsonb_object_keys(v_responses) loop
    if not (v_key = any(v_custom_ids)) then
      raise exception 'The field "%" is not part of this session''s registration form.', v_key;
    end if;
  end loop;

  for v_field in select value from jsonb_array_elements(p_schema -> 'fields') loop
    v_type := v_field ->> 'type';
    continue when v_type in ('full_name', 'department');

    v_key := v_field ->> 'id';
    v_label := v_field ->> 'label';
    v_required := coalesce((v_field ->> 'required')::boolean, false);
    v_raw := v_responses -> v_key;
    v_clean := null;

    if v_raw is null or jsonb_typeof(v_raw) = 'null' then
      v_clean := null;

    elsif v_type = 'checkbox' then
      if jsonb_typeof(v_raw) <> 'array' then
        raise exception '"%" must be a list of selected options.', v_label;
      end if;
      v_arr := '[]'::jsonb;
      for v_item in select value from jsonb_array_elements(v_raw) loop
        if jsonb_typeof(v_item) <> 'string'
          or not ((v_field -> 'options') @> jsonb_build_array(v_item #>> '{}')) then
          raise exception 'Please choose valid options for "%".', v_label;
        end if;
        if not (v_arr @> jsonb_build_array(v_item)) then
          v_arr := v_arr || jsonb_build_array(v_item);
        end if;
      end loop;
      if jsonb_array_length(v_arr) > 0 then
        v_clean := v_arr;
      end if;

    elsif v_type = 'yes_no' then
      if jsonb_typeof(v_raw) = 'boolean' then
        v_clean := to_jsonb(case when v_raw = 'true'::jsonb then 'yes' else 'no' end);
      elsif jsonb_typeof(v_raw) = 'string' and trim(v_raw #>> '{}') = '' then
        v_clean := null;
      elsif jsonb_typeof(v_raw) = 'string' and lower(trim(v_raw #>> '{}')) in ('yes', 'no') then
        v_clean := to_jsonb(lower(trim(v_raw #>> '{}')));
      else
        raise exception 'Please answer Yes or No for "%".', v_label;
      end if;

    elsif v_type = 'number' then
      v_num := null;
      if jsonb_typeof(v_raw) = 'number' then
        v_num := (v_raw #>> '{}')::numeric;
      elsif jsonb_typeof(v_raw) = 'string' then
        v_text := trim(v_raw #>> '{}');
        if v_text <> '' then
          if v_text ~ '^-?[0-9]{1,15}(\.[0-9]{1,6})?$' then
            v_num := v_text::numeric;
          else
            raise exception '"%" must be a number.', v_label;
          end if;
        end if;
      else
        raise exception '"%" must be a number.', v_label;
      end if;
      if v_num is not null then
        if abs(v_num) >= 1e15 then
          raise exception '"%" is out of range.', v_label;
        end if;
        v_clean := to_jsonb(v_num);
      end if;

    else
      if jsonb_typeof(v_raw) <> 'string' then
        raise exception 'Invalid value submitted for "%".', v_label;
      end if;
      v_text := trim(v_raw #>> '{}');
      if v_text <> '' then
        if v_type = 'short_text' then
          v_text := regexp_replace(v_text, '\s+', ' ', 'g');
          if char_length(v_text) > 500 then
            raise exception '"%" is too long (maximum 500 characters).', v_label;
          end if;
        elsif v_type = 'email' then
          v_text := lower(v_text);
          if char_length(v_text) > 254 or v_text !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
            raise exception 'Please enter a valid email address for "%".', v_label;
          end if;
        elsif v_type = 'phone' then
          if v_text !~ '^\+?[0-9][0-9 ()-]{5,22}$'
            or char_length(regexp_replace(v_text, '[^0-9]', '', 'g')) not between 7 and 15 then
            raise exception 'Please enter a valid phone number for "%".', v_label;
          end if;
        elsif v_type in ('select', 'radio') then
          if not ((v_field -> 'options') @> jsonb_build_array(v_text)) then
            raise exception 'Please choose a valid option for "%".', v_label;
          end if;
        end if;
        v_clean := to_jsonb(v_text);
      end if;
    end if;

    if v_clean is null then
      if v_required then
        raise exception '"%" is required.', v_label;
      end if;
    else
      v_result := v_result || jsonb_build_object(
        v_key,
        jsonb_build_object('label', v_label, 'type', v_type, 'value', v_clean)
      );
    end if;
  end loop;

  return v_result;
end;
$$;

-- 8.3 Department resolution against the session form configuration.
create or replace function public.ln_resolve_department(
  p_session public.attendance_sessions,
  p_department_id text,
  p_custom_department text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_field jsonb;
  v_required boolean;
  v_choice text := lower(trim(coalesce(p_department_id, '')));
  v_custom text;
  v_uuid uuid;
  v_dept public.departments%rowtype;
begin
  select f into v_field
  from jsonb_array_elements(p_session.form_schema -> 'fields') f
  where f ->> 'type' = 'department'
  limit 1;

  if v_field is null then
    return jsonb_build_object('departmentId', null, 'departmentName', 'Not collected', 'customDepartment', null);
  end if;

  v_required := coalesce((v_field ->> 'required')::boolean, false);

  if v_choice = '' then
    if v_required then
      raise exception 'Please select a department.';
    end if;
    return jsonb_build_object('departmentId', null, 'departmentName', 'Not specified', 'customDepartment', null);
  end if;

  if v_choice = 'congregation' then
    return jsonb_build_object('departmentId', null, 'departmentName', 'General Congregation', 'customDepartment', null);
  end if;

  if v_choice = 'other' then
    if not p_session.allow_other_department then
      raise exception 'Custom department entry is not enabled for this session.';
    end if;
    v_custom := trim(regexp_replace(coalesce(p_custom_department, ''), '\s+', ' ', 'g'));
    if char_length(v_custom) < 2 or char_length(v_custom) > 80 then
      raise exception 'Please specify the department or unit name.';
    end if;
    return jsonb_build_object('departmentId', null, 'departmentName', v_custom, 'customDepartment', v_custom);
  end if;

  begin
    v_uuid := trim(p_department_id)::uuid;
  exception when others then
    raise exception 'Please select a valid department.';
  end;

  select * into v_dept
  from public.departments
  where id = v_uuid
    and organization_id = p_session.organization_id
    and enabled = true;

  if not found then
    raise exception 'The selected department is not available for this session.';
  end if;

  return jsonb_build_object('departmentId', v_dept.id, 'departmentName', v_dept.name, 'customDepartment', null);
end;
$$;

-- 8.4 Session window state (single source of truth for BOTH QR methods).
--     'upcoming'/'active' follow the configured schedule; 'closed'/'expired'
--     are a manual administrative close.
create or replace function public.ln_session_window_state(p_session public.attendance_sessions)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when p_session.status in ('closed', 'expired') then 'closed'
    when now() < p_session.opens_at then 'not-open'
    when now() >= p_session.closes_at then 'closed'
    else 'open'
  end;
$$;

-- 8.5 GPS geofence verification (server-side).
create or replace function public.ln_check_location(
  p_session public.attendance_sessions,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy double precision
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org public.organizations%rowtype;
  v_lat double precision;
  v_lng double precision;
  v_radius integer;
  v_threshold integer;
  v_distance double precision;
begin
  select * into v_org from public.organizations where id = p_session.organization_id;

  v_lat := coalesce(p_session.geofence_latitude, v_org.geofence_latitude);
  v_lng := coalesce(p_session.geofence_longitude, v_org.geofence_longitude);
  v_radius := coalesce(p_session.geofence_radius_m, v_org.geofence_radius_m, 100);
  v_threshold := coalesce(p_session.gps_accuracy_threshold_m, v_org.gps_accuracy_threshold_m, 50);

  if v_lat is null or v_lng is null then
    return jsonb_build_object('status', 'location-not-configured');
  end if;

  if p_latitude is null or p_longitude is null or p_accuracy is null then
    return jsonb_build_object('status', 'location-required');
  end if;

  if p_latitude = 'NaN'::double precision
    or p_longitude = 'NaN'::double precision
    or p_accuracy = 'NaN'::double precision
    or p_latitude not between -90 and 90
    or p_longitude not between -180 and 180
    or p_accuracy <= 0
    or p_accuracy > 100000 then
    return jsonb_build_object('status', 'invalid-location');
  end if;

  v_distance := public.ln_distance_m(v_lat, v_lng, p_latitude, p_longitude);

  -- Clearly outside: even the most favourable point of the accuracy circle is
  -- beyond the permitted radius. Retrying will not help.
  if v_distance - p_accuracy > v_radius then
    return jsonb_build_object(
      'status', 'outside-geofence',
      'distanceM', round(v_distance)::integer,
      'radiusM', v_radius
    );
  end if;

  if p_accuracy > v_threshold then
    return jsonb_build_object(
      'status', 'poor-accuracy',
      'accuracyM', round(p_accuracy)::integer,
      'accuracyThresholdM', v_threshold
    );
  end if;

  if v_distance > v_radius then
    return jsonb_build_object(
      'status', 'outside-geofence',
      'distanceM', round(v_distance)::integer,
      'radiusM', v_radius
    );
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'distanceM', round(v_distance)::integer,
    'accuracyM', round(p_accuracy)::integer,
    'radiusM', v_radius
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 8.6 Session triggers: secure tokens, absolute window, form versioning, audit
-- ----------------------------------------------------------------------------

create or replace function public.ln_prepare_attendance_session()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_tz text;
  v_rotation boolean := coalesce(current_setting('app.ln_token_rotation', true), 'false') = 'true';
  v_schedule_changed boolean;
begin
  if tg_op = 'INSERT' then
    select timezone into v_org_tz from public.organizations where id = new.organization_id;
    new.timezone := coalesce(nullif(trim(new.timezone), ''), v_org_tz, 'Africa/Lagos');
    -- Tokens are ALWAYS generated server-side; any client-supplied value is ignored.
    new.qr_token := public.ln_random_token('g_');
    new.form_version := 1;
    new.registration_count := 0;
    v_schedule_changed := true;
  else
    if new.qr_token is distinct from old.qr_token and not v_rotation then
      raise exception 'QR access tokens can only be changed with the revoke/regenerate action.';
    end if;
    if new.organization_id is distinct from old.organization_id then
      raise exception 'Attendance sessions cannot be moved between organizations.';
    end if;
    new.timezone := coalesce(nullif(trim(new.timezone), ''), old.timezone);
    v_schedule_changed :=
      new.session_date is distinct from old.session_date
      or new.start_time is distinct from old.start_time
      or new.end_time is distinct from old.end_time
      or new.timezone is distinct from old.timezone;
  end if;

  if v_schedule_changed then
    begin
      perform now() at time zone new.timezone;
    exception when others then
      raise exception 'Invalid session timezone: %', new.timezone;
    end;

    if new.end_time <= new.start_time then
      raise exception 'Closing time must be later than opening time.';
    end if;
  end if;

  -- Always derived from the configured local date/time + session timezone so
  -- that opens_at / closes_at can never be set independently by a client.
  new.opens_at := (new.session_date + new.start_time) at time zone new.timezone;
  new.closes_at := (new.session_date + new.end_time) at time zone new.timezone;

  new.form_schema := coalesce(new.form_schema, public.ln_default_form_schema());

  if tg_op = 'INSERT' or new.form_schema is distinct from old.form_schema then
    perform public.ln_validate_form_schema(new.form_schema);
  end if;

  if tg_op = 'UPDATE' then
    if new.form_schema is distinct from old.form_schema then
      new.form_version := old.form_version + 1;
    else
      new.form_version := old.form_version;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_ln_prepare_attendance_session on public.attendance_sessions;
create trigger trg_ln_prepare_attendance_session
  before insert or update on public.attendance_sessions
  for each row execute function public.ln_prepare_attendance_session();

create or replace function public.ln_after_attendance_session_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changes jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    insert into public.session_access_tokens (organization_id, session_id, access_type, token, created_by)
    values
      (new.organization_id, new.id, 'general', lower(new.qr_token), new.created_by),
      (new.organization_id, new.id, 'protocol', public.ln_random_token('p_'), new.created_by);

    insert into public.session_form_versions (organization_id, session_id, version, form_schema, created_by)
    values (new.organization_id, new.id, new.form_version, new.form_schema, new.created_by)
    on conflict (session_id, version) do nothing;

    perform public.ln_log_action(new.organization_id, new.id, 'session.created', jsonb_build_object(
      'title', new.title,
      'sessionType', new.session_type,
      'opensAt', new.opens_at,
      'closesAt', new.closes_at,
      'timezone', new.timezone
    ));
    return new;

  elsif tg_op = 'UPDATE' then
    if new.form_version <> old.form_version then
      insert into public.session_form_versions (organization_id, session_id, version, form_schema, created_by)
      values (
        new.organization_id,
        new.id,
        new.form_version,
        new.form_schema,
        case when exists (select 1 from public.admin_profiles where id = auth.uid()) then auth.uid() end
      )
      on conflict (session_id, version) do nothing;
      v_changes := v_changes || jsonb_build_object('formVersion', jsonb_build_object('from', old.form_version, 'to', new.form_version));
    end if;

    if new.opens_at is distinct from old.opens_at or new.closes_at is distinct from old.closes_at then
      v_changes := v_changes || jsonb_build_object(
        'window', jsonb_build_object(
          'fromOpensAt', old.opens_at, 'fromClosesAt', old.closes_at,
          'toOpensAt', new.opens_at, 'toClosesAt', new.closes_at
        )
      );
    end if;

    if new.status is distinct from old.status then
      v_changes := v_changes || jsonb_build_object('status', jsonb_build_object('from', old.status, 'to', new.status));
    end if;

    if new.session_type is distinct from old.session_type then
      v_changes := v_changes || jsonb_build_object('sessionType', jsonb_build_object('from', old.session_type, 'to', new.session_type));
    end if;

    if new.geofence_latitude is distinct from old.geofence_latitude
      or new.geofence_longitude is distinct from old.geofence_longitude
      or new.geofence_radius_m is distinct from old.geofence_radius_m
      or new.gps_accuracy_threshold_m is distinct from old.gps_accuracy_threshold_m then
      v_changes := v_changes || jsonb_build_object('geofenceOverride', true);
    end if;

    if v_changes <> '{}'::jsonb then
      perform public.ln_log_action(new.organization_id, new.id, 'session.updated', v_changes);
    end if;
    return new;

  elsif tg_op = 'DELETE' then
    -- Skip when the whole organization is being deleted (cascade).
    if not exists (select 1 from public.organizations where id = old.organization_id) then
      return old;
    end if;
    perform public.ln_log_action(old.organization_id, null, 'session.deleted', jsonb_build_object(
      'sessionId', old.id,
      'title', old.title,
      'sessionDate', old.session_date,
      'registrationCount', old.registration_count
    ));
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_ln_after_attendance_session_write on public.attendance_sessions;
create trigger trg_ln_after_attendance_session_write
  after insert or update or delete on public.attendance_sessions
  for each row execute function public.ln_after_attendance_session_write();

-- ----------------------------------------------------------------------------
-- 9. Registration core + public (GPS) and protocol RPCs
-- ----------------------------------------------------------------------------

create or replace function public.ln_record_json(
  p_record public.attendance_records,
  p_session public.attendance_sessions,
  p_include_registrar boolean default false
)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'id', p_record.id,
    'sessionId', p_record.session_id,
    'sessionTitle', p_session.title,
    'sessionType', p_session.session_type,
    'sessionDate', p_session.session_date::text,
    'fullName', p_record.full_name,
    'departmentId', case
      when p_record.department_id is not null then p_record.department_id::text
      when p_record.custom_department is not null then 'other'
      when p_record.department_name_snapshot = 'General Congregation' then 'congregation'
      else 'none'
    end,
    'departmentName', p_record.department_name_snapshot,
    'customDepartment', p_record.custom_department,
    'submittedAt', p_record.submitted_at,
    'source', p_record.source,
    'verificationMethod', p_record.verification_method,
    'registeredByName', case when p_include_registrar then p_record.registered_by_name end
  );
$$;

-- Internal: shared insert path for BOTH QR methods (same table, same unique
-- constraint, same validation). Never granted to anon/authenticated.
create or replace function public.ln_register_attendance(
  p_session_id uuid,
  p_token_id uuid,
  p_method text,
  p_registered_by uuid,
  p_full_name text,
  p_department_id text,
  p_custom_department text,
  p_responses jsonb,
  p_gps_distance_m integer default null,
  p_gps_accuracy_m integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.attendance_sessions%rowtype;
  v_clean_name text;
  v_normalized text;
  v_dept jsonb;
  v_responses jsonb;
  v_existing public.attendance_records%rowtype;
  v_inserted public.attendance_records%rowtype;
  v_registrar_name text;
  v_include_registrar boolean := p_method = 'protocol_verified';
begin
  if p_method not in ('gps_verified', 'protocol_verified') then
    raise exception 'Unsupported verification method.';
  end if;

  select * into v_session from public.attendance_sessions where id = p_session_id;
  if not found then
    return jsonb_build_object('outcome', 'invalid-qr');
  end if;

  v_clean_name := trim(regexp_replace(coalesce(p_full_name, ''), '\s+', ' ', 'g'));
  if char_length(v_clean_name) < 3 then
    raise exception 'Please enter the full name (at least 3 characters).';
  end if;
  if char_length(v_clean_name) > 120 then
    raise exception 'The full name is too long (maximum 120 characters).';
  end if;
  v_normalized := lower(v_clean_name);

  -- Duplicate recognition across BOTH methods (single attendance list).
  select * into v_existing
  from public.attendance_records
  where session_id = v_session.id
    and normalized_name = v_normalized
  limit 1;

  if found then
    return jsonb_build_object(
      'outcome', 'duplicate',
      'record', public.ln_record_json(v_existing, v_session, v_include_registrar)
    );
  end if;

  v_dept := public.ln_resolve_department(v_session, p_department_id, p_custom_department);
  v_responses := public.ln_validate_form_responses(v_session.form_schema, p_responses);

  if p_registered_by is not null then
    select full_name into v_registrar_name from public.admin_profiles where id = p_registered_by;
  end if;

  begin
    insert into public.attendance_records (
      organization_id,
      session_id,
      full_name,
      department_id,
      department_name_snapshot,
      custom_department,
      source,
      verification_method,
      registered_by,
      registered_by_name,
      access_token_id,
      responses,
      form_version,
      gps_distance_m,
      gps_accuracy_m
    ) values (
      v_session.organization_id,
      v_session.id,
      v_clean_name,
      nullif(v_dept ->> 'departmentId', '')::uuid,
      v_dept ->> 'departmentName',
      v_dept ->> 'customDepartment',
      case when p_method = 'protocol_verified' then 'protocol' else 'qr-web' end,
      p_method,
      p_registered_by,
      v_registrar_name,
      p_token_id,
      v_responses,
      v_session.form_version,
      p_gps_distance_m,
      p_gps_accuracy_m
    )
    returning * into v_inserted;
  exception when unique_violation then
    select * into v_existing
    from public.attendance_records
    where session_id = v_session.id
      and normalized_name = v_normalized
    limit 1;

    return jsonb_build_object(
      'outcome', 'duplicate',
      'record', public.ln_record_json(v_existing, v_session, v_include_registrar)
    );
  end;

  return jsonb_build_object(
    'outcome', 'success',
    'record', public.ln_record_json(v_inserted, v_session, v_include_registrar)
  );
end;
$$;

-- Internal: public-safe session payload (never exposes church coordinates).
create or replace function public.ln_session_payload(
  p_session public.attendance_sessions,
  p_outcome text,
  p_access_type text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org public.organizations%rowtype;
  v_departments jsonb;
begin
  select * into v_org from public.organizations where id = p_session.organization_id;

  select coalesce(
    jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name, 'code', d.code) order by d.name asc),
    '[]'::jsonb
  )
  into v_departments
  from public.departments d
  where d.organization_id = p_session.organization_id
    and d.enabled = true;

  return jsonb_build_object(
    'outcome', p_outcome,
    'accessType', p_access_type,
    'churchName', v_org.name,
    'branchName', v_org.branch,
    'serverNow', now(),
    'session', jsonb_build_object(
      'id', p_session.id,
      'title', p_session.title,
      'sessionType', p_session.session_type,
      'date', p_session.session_date::text,
      'startTime', to_char(p_session.start_time, 'HH24:MI'),
      'endTime', to_char(p_session.end_time, 'HH24:MI'),
      'opensAt', p_session.opens_at,
      'closesAt', p_session.closes_at,
      'timezone', p_session.timezone,
      'location', p_session.location,
      'notes', p_session.notes,
      'allowOtherDepartment', p_session.allow_other_department,
      'registrationCount', p_session.registration_count
    ),
    'form', jsonb_build_object(
      'version', p_session.form_version,
      'fields', p_session.form_schema -> 'fields'
    ),
    'departments', v_departments,
    'gps', jsonb_build_object(
      'required', p_access_type = 'general',
      'configured', coalesce(p_session.geofence_latitude, v_org.geofence_latitude) is not null
        and coalesce(p_session.geofence_longitude, v_org.geofence_longitude) is not null,
      'radiusM', coalesce(p_session.geofence_radius_m, v_org.geofence_radius_m, 100),
      'accuracyThresholdM', coalesce(p_session.gps_accuracy_threshold_m, v_org.gps_accuracy_threshold_m, 50)
    )
  );
end;
$$;

-- The legacy submission RPC performed NO location verification. It is removed
-- so that the General Attendance QR cannot be used to bypass GPS.
drop function if exists public.submit_public_attendance(text, text, text, text);

-- 9.1 Public General Attendance QR lookup (replaces 6.4 from 0001).
create or replace function public.get_public_session_by_token(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_token public.session_access_tokens%rowtype;
  v_session public.attendance_sessions%rowtype;
begin
  if p_token is null or trim(p_token) = '' then
    return jsonb_build_object('outcome', 'invalid-qr');
  end if;

  select * into v_token from public.session_access_tokens where token = lower(trim(p_token)) limit 1;

  if not found then
    return jsonb_build_object('outcome', 'invalid-qr');
  end if;

  if v_token.revoked_at is not null then
    return jsonb_build_object('outcome', 'invalid-qr', 'reason', 'revoked');
  end if;

  if v_token.access_type not in ('general', 'protocol') then
    return jsonb_build_object('outcome', 'invalid-qr');
  end if;

  select * into v_session from public.attendance_sessions where id = v_token.session_id;
  if not found then
    return jsonb_build_object('outcome', 'invalid-qr');
  end if;

  return public.ln_session_payload(v_session, public.ln_session_window_state(v_session), v_token.access_type);
end;
$$;

grant execute on function public.get_public_session_by_token(text) to anon, authenticated;

-- 9.2 Public GPS pre-check (UX only — the submission re-verifies everything).
create or replace function public.check_attendance_location(
  p_token text,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy double precision
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_token public.session_access_tokens%rowtype;
  v_session public.attendance_sessions%rowtype;
  v_state text;
begin
  select * into v_token
  from public.session_access_tokens
  where token = lower(trim(coalesce(p_token, '')))
    and revoked_at is null
    and access_type = 'general'
  limit 1;

  if not found then
    return jsonb_build_object('outcome', 'invalid-qr');
  end if;

  select * into v_session from public.attendance_sessions where id = v_token.session_id;
  v_state := public.ln_session_window_state(v_session);

  if v_state <> 'open' then
    return jsonb_build_object('outcome', v_state);
  end if;

  return jsonb_build_object(
    'outcome', 'open',
    'location', public.ln_check_location(v_session, p_latitude, p_longitude, p_accuracy)
  );
end;
$$;

grant execute on function public.check_attendance_location(text, double precision, double precision, double precision) to anon, authenticated;

-- 9.3 Public GPS-verified submission (General Attendance QR).
create or replace function public.submit_gps_attendance(
  p_token text,
  p_full_name text,
  p_department_id text,
  p_custom_department text,
  p_responses jsonb,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy double precision
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token public.session_access_tokens%rowtype;
  v_session public.attendance_sessions%rowtype;
  v_state text;
  v_location jsonb;
begin
  if p_token is null or trim(p_token) = '' then
    return jsonb_build_object('outcome', 'invalid-qr');
  end if;

  select * into v_token from public.session_access_tokens where token = lower(trim(p_token)) limit 1;

  if not found or v_token.revoked_at is not null then
    return jsonb_build_object('outcome', 'invalid-qr');
  end if;

  if v_token.access_type <> 'general' then
    return jsonb_build_object('outcome', 'protocol-only');
  end if;

  select * into v_session from public.attendance_sessions where id = v_token.session_id;
  if not found then
    return jsonb_build_object('outcome', 'invalid-qr');
  end if;

  v_state := public.ln_session_window_state(v_session);
  if v_state <> 'open' then
    return jsonb_build_object('outcome', v_state);
  end if;

  v_location := public.ln_check_location(v_session, p_latitude, p_longitude, p_accuracy);
  if v_location ->> 'status' <> 'ok' then
    return jsonb_build_object('outcome', v_location ->> 'status', 'location', v_location);
  end if;

  -- Precise coordinates are NOT stored; only rounded distance and accuracy.
  return public.ln_register_attendance(
    v_session.id,
    v_token.id,
    'gps_verified',
    null,
    p_full_name,
    p_department_id,
    p_custom_department,
    p_responses,
    (v_location ->> 'distanceM')::integer,
    (v_location ->> 'accuracyM')::integer
  );
end;
$$;

grant execute on function public.submit_gps_attendance(text, text, text, text, jsonb, double precision, double precision, double precision) to anon, authenticated;

-- 9.4 Protocol-verified submission (Protocol QR: no GPS required, public scan at entrance).
--     Shares the exact same session, form, duplicate rules, and opening/closing times.
--     NON-NEGOTIABLE: Protocol QR CANNOT bypass opening or closing times.
create or replace function public.submit_protocol_attendance(
  p_token text,
  p_full_name text,
  p_department_id text,
  p_custom_department text,
  p_responses jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token public.session_access_tokens%rowtype;
  v_session public.attendance_sessions%rowtype;
  v_state text;
begin
  if p_token is null or trim(p_token) = '' then
    return jsonb_build_object('outcome', 'invalid-qr');
  end if;

  select * into v_token from public.session_access_tokens where token = lower(trim(p_token)) limit 1;

  if not found or v_token.revoked_at is not null then
    return jsonb_build_object('outcome', 'invalid-qr');
  end if;

  if v_token.access_type <> 'protocol' then
    return jsonb_build_object('outcome', 'general-token');
  end if;

  select * into v_session from public.attendance_sessions where id = v_token.session_id;
  if not found then
    return jsonb_build_object('outcome', 'invalid-qr');
  end if;

  -- SHARED TIME RESTRICTION: Reject registrations before opening and after closing.
  v_state := public.ln_session_window_state(v_session);
  if v_state <> 'open' then
    return jsonb_build_object('outcome', v_state);
  end if;

  return public.ln_register_attendance(
    v_session.id,
    v_token.id,
    'protocol_verified',
    null,
    p_full_name,
    p_department_id,
    p_custom_department,
    p_responses
  );
end;
$$;

grant execute on function public.submit_protocol_attendance(text, text, text, text, jsonb) to anon, authenticated;

-- 9.5 Unified public attendance submission (dispatches to GPS or Protocol based on token).
create or replace function public.submit_public_attendance(
  p_token text,
  p_full_name text,
  p_department_id text,
  p_custom_department text,
  p_responses jsonb,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_accuracy double precision default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token public.session_access_tokens%rowtype;
begin
  if p_token is null or trim(p_token) = '' then
    return jsonb_build_object('outcome', 'invalid-qr');
  end if;

  select * into v_token from public.session_access_tokens where token = lower(trim(p_token)) limit 1;
  if not found or v_token.revoked_at is not null then
    return jsonb_build_object('outcome', 'invalid-qr');
  end if;

  if v_token.access_type = 'general' then
    return public.submit_gps_attendance(
      p_token, p_full_name, p_department_id, p_custom_department, p_responses,
      p_latitude, p_longitude, p_accuracy
    );
  elsif v_token.access_type = 'protocol' then
    return public.submit_protocol_attendance(
      p_token, p_full_name, p_department_id, p_custom_department, p_responses
    );
  else
    return jsonb_build_object('outcome', 'invalid-qr');
  end if;
end;
$$;

grant execute on function public.submit_public_attendance(text, text, text, text, jsonb, double precision, double precision, double precision) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 10. Token revoke / regenerate (staff only; never touches attendance records)
-- ----------------------------------------------------------------------------

create or replace function public.rotate_session_access_token(
  p_session_id uuid,
  p_access_type text,
  p_regenerate boolean default true,
  p_reason text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.admin_profiles%rowtype;
  v_session public.attendance_sessions%rowtype;
  v_old public.session_access_tokens%rowtype;
  v_new public.session_access_tokens%rowtype;
  v_new_token text;
begin
  select * into v_profile
  from public.admin_profiles
  where id = auth.uid()
    and is_active = true
    and role in ('super_admin', 'admin', 'coordinator');

  if not found then
    raise exception 'Only church administrators can manage QR access tokens.';
  end if;

  if p_access_type not in ('general', 'protocol') then
    raise exception 'Unknown QR access type.';
  end if;

  select * into v_session
  from public.attendance_sessions
  where id = p_session_id
    and organization_id = v_profile.organization_id
  for update;

  if not found then
    raise exception 'Attendance session not found.';
  end if;

  update public.session_access_tokens
  set revoked_at = now(),
      revoked_by = v_profile.id,
      revoke_reason = left(trim(coalesce(p_reason, '')), 300)
  where session_id = v_session.id
    and access_type = p_access_type
    and revoked_at is null
  returning * into v_old;

  if coalesce(p_regenerate, true) then
    v_new_token := public.ln_random_token(case when p_access_type = 'general' then 'g_' else 'p_' end);
    insert into public.session_access_tokens (organization_id, session_id, access_type, token, created_by)
    values (v_session.organization_id, v_session.id, p_access_type, v_new_token, v_profile.id)
    returning * into v_new;
  end if;

  if p_access_type = 'general' then
    perform set_config('app.ln_token_rotation', 'true', true);
    update public.attendance_sessions
    set qr_token = coalesce(v_new_token, public.ln_random_token('x_'))
    where id = v_session.id;
    perform set_config('app.ln_token_rotation', 'false', true);
  end if;

  perform public.ln_log_action(
    v_session.organization_id,
    v_session.id,
    case when coalesce(p_regenerate, true) then 'token.regenerated' else 'token.revoked' end,
    jsonb_build_object(
      'accessType', p_access_type,
      'revokedTokenId', v_old.id,
      'newTokenId', v_new.id,
      'reason', left(trim(coalesce(p_reason, '')), 300)
    )
  );

  return jsonb_build_object(
    'accessType', p_access_type,
    'token', v_new_token,
    'tokenId', v_new.id,
    'revokedTokenId', v_old.id
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 11. Attendance analytics (staff only, organization scoped)
-- ----------------------------------------------------------------------------

create or replace function public.get_attendance_analytics(
  p_from date default null,
  p_to date default null,
  p_session_type text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_tz text;
  v_today date;
  v_type text := nullif(trim(coalesce(p_session_type, '')), '');
  v_result jsonb;
begin
  if not public.current_user_is_staff() then
    raise exception 'Only church administrators can view attendance analytics.';
  end if;

  if v_type is not null and v_type not in ('sunday_service', 'workers_meeting', 'conference', 'general_event', 'custom') then
    raise exception 'Unknown session type filter.';
  end if;

  v_org := public.current_user_org_id();
  select coalesce(timezone, 'Africa/Lagos') into v_tz from public.organizations where id = v_org;
  v_today := (now() at time zone v_tz)::date;

  with sess as (
    select s.*
    from public.attendance_sessions s
    where s.organization_id = v_org
      and (p_from is null or s.session_date >= p_from)
      and (p_to is null or s.session_date <= p_to)
  ),
  recs as (
    select
      r.id,
      r.normalized_name,
      r.department_name_snapshot as department,
      r.verification_method,
      s.id as session_id,
      s.session_type,
      s.session_date
    from public.attendance_records r
    join sess s on s.id = r.session_id
  ),
  filtered as (
    select * from recs where v_type is null or session_type = v_type
  ),
  sunday_days as (
    select
      s.session_date as day,
      count(r.id)::integer as registrations,
      count(distinct r.normalized_name)::integer as unique_people,
      count(distinct s.id)::integer as services
    from sess s
    left join recs r on r.session_id = s.id
    where s.session_type = 'sunday_service'
      and s.session_date <= v_today
    group by s.session_date
  ),
  ranked as (
    select day, registrations, row_number() over (order by day desc) as rn
    from sunday_days
  )
  select jsonb_build_object(
    'generatedAt', now(),
    'timezone', v_tz,
    'today', v_today,
    'filters', jsonb_build_object('from', p_from, 'to', p_to, 'sessionType', v_type),
    'overview', jsonb_build_object(
      'totalRegistrations', (select count(*) from filtered),
      'uniquePeople', (select count(distinct normalized_name) from filtered),
      'sundayRegistrations', (select count(*) from recs where session_type = 'sunday_service'),
      'sundayUniquePeople', (select count(distinct normalized_name) from recs where session_type = 'sunday_service'),
      'otherRegistrations', (select count(*) from recs where session_type <> 'sunday_service'),
      'otherUniquePeople', (select count(distinct normalized_name) from recs where session_type <> 'sunday_service'),
      'sessionsCount', (select count(*) from sess where v_type is null or session_type = v_type),
      'sundayCount', (select count(*) from sunday_days),
      'averageSunday', (select round(avg(registrations)::numeric, 1) from sunday_days),
      'latestSunday', (select jsonb_build_object('date', day, 'registrations', registrations) from ranked where rn = 1),
      'previousSunday', (select jsonb_build_object('date', day, 'registrations', registrations) from ranked where rn = 2),
      'changePct', (
        select case
          when p.registrations > 0 then round(((l.registrations - p.registrations)::numeric / p.registrations) * 100, 1)
        end
        from ranked l, ranked p
        where l.rn = 1 and p.rn = 2
      )
    ),
    'sundayWeekly', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'date', day,
        'registrations', registrations,
        'uniquePeople', unique_people,
        'services', services
      ) order by day), '[]'::jsonb)
      from sunday_days
    ),
    'monthly', (
      select coalesce(jsonb_agg(m order by m ->> 'month'), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'month', to_char(date_trunc('month', session_date), 'YYYY-MM'),
          'sunday', count(*) filter (where session_type = 'sunday_service'),
          'other', count(*) filter (where session_type <> 'sunday_service'),
          'total', count(*),
          'uniquePeople', count(distinct normalized_name)
        ) as m
        from filtered
        group by date_trunc('month', session_date)
      ) x
    ),
    'weekly', (
      select coalesce(jsonb_agg(w order by w ->> 'weekStart'), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'weekStart', date_trunc('week', session_date)::date,
          'registrations', count(*),
          'uniquePeople', count(distinct normalized_name)
        ) as w
        from filtered
        group by date_trunc('week', session_date)
      ) x
    ),
    'daily', (
      select coalesce(jsonb_agg(d order by d ->> 'date'), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'date', session_date,
          'registrations', count(*),
          'uniquePeople', count(distinct normalized_name),
          'sessions', count(distinct session_id)
        ) as d
        from filtered
        group by session_date
      ) x
    ),
    'byDepartment', (
      select coalesce(jsonb_agg(d order by (d ->> 'registrations')::integer desc, d ->> 'department'), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'department', department,
          'registrations', count(*),
          'uniquePeople', count(distinct normalized_name)
        ) as d
        from filtered
        group by department
      ) x
    ),
    'bySessionType', (
      select coalesce(jsonb_agg(t order by (t ->> 'registrations')::integer desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'sessionType', s.session_type,
          'sessions', count(distinct s.id),
          'registrations', count(r.id),
          'uniquePeople', count(distinct r.normalized_name)
        ) as t
        from sess s
        left join recs r on r.session_id = s.id
        group by s.session_type
      ) x
    ),
    'byVerificationMethod', (
      select coalesce(jsonb_agg(v order by (v ->> 'registrations')::integer desc), '[]'::jsonb)
      from (
        select jsonb_build_object('method', verification_method, 'registrations', count(*)) as v
        from filtered
        group by verification_method
      ) x
    ),
    'sessions', (
      select coalesce(jsonb_agg(s order by s ->> 'date' desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id', s.id,
          'title', s.title,
          'sessionType', s.session_type,
          'date', s.session_date,
          'registrations', s.registration_count
        ) as s
        from sess s
        where v_type is null or s.session_type = v_type
        order by s.session_date desc
        limit 60
      ) x
    )
  )
  into v_result;

  return v_result;
end;
$$;

-- ----------------------------------------------------------------------------
-- 12. Function privileges
-- ----------------------------------------------------------------------------
-- Supabase grants EXECUTE on new public functions to anon/authenticated by
-- default. Internal helpers MUST NOT be callable from the API.

revoke all on function public.ln_random_token(text) from public, anon, authenticated;
revoke all on function public.ln_log_action(uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.ln_validate_form_schema(jsonb) from public, anon, authenticated;
revoke all on function public.ln_validate_form_responses(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.ln_resolve_department(public.attendance_sessions, text, text) from public, anon, authenticated;
revoke all on function public.ln_session_window_state(public.attendance_sessions) from public, anon, authenticated;
revoke all on function public.ln_check_location(public.attendance_sessions, double precision, double precision, double precision) from public, anon, authenticated;
revoke all on function public.ln_prepare_attendance_session() from public, anon, authenticated;
revoke all on function public.ln_after_attendance_session_write() from public, anon, authenticated;
revoke all on function public.ln_record_json(public.attendance_records, public.attendance_sessions, boolean) from public, anon, authenticated;
revoke all on function public.ln_register_attendance(uuid, uuid, text, uuid, text, text, text, jsonb, integer, integer) from public, anon, authenticated;
revoke all on function public.ln_session_payload(public.attendance_sessions, text, text) from public, anon, authenticated;

revoke all on function public.rotate_session_access_token(uuid, text, boolean, text) from public, anon;
revoke all on function public.get_attendance_analytics(date, date, text) from public, anon;

grant execute on function public.rotate_session_access_token(uuid, text, boolean, text) to authenticated;
grant execute on function public.get_attendance_analytics(date, date, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 13. Row Level Security
-- ----------------------------------------------------------------------------

alter table public.session_access_tokens enable row level security;
alter table public.session_form_versions enable row level security;
alter table public.attendance_audit_logs enable row level security;

-- Tokens / form versions / audit logs: staff read-only. Writes happen only in
-- SECURITY DEFINER functions and triggers.
drop policy if exists "Staff can view session access tokens" on public.session_access_tokens;
create policy "Staff can view session access tokens"
  on public.session_access_tokens for select
  to authenticated
  using (organization_id = public.current_user_org_id() and public.current_user_is_staff());

drop policy if exists "Staff can view session form versions" on public.session_form_versions;
create policy "Staff can view session form versions"
  on public.session_form_versions for select
  to authenticated
  using (organization_id = public.current_user_org_id() and public.current_user_is_staff());

drop policy if exists "Staff can view attendance audit logs" on public.attendance_audit_logs;
create policy "Staff can view attendance audit logs"
  on public.attendance_audit_logs for select
  to authenticated
  using (organization_id = public.current_user_org_id() and public.current_user_is_staff());

-- Departments: everyone in the org may read; only staff may write.
drop policy if exists "Admins can insert departments in their organization" on public.departments;
create policy "Admins can insert departments in their organization"
  on public.departments for insert
  to authenticated
  with check (organization_id = public.current_user_org_id() and public.current_user_is_staff());

drop policy if exists "Admins can update departments in their organization" on public.departments;
create policy "Admins can update departments in their organization"
  on public.departments for update
  to authenticated
  using (organization_id = public.current_user_org_id() and public.current_user_is_staff())
  with check (organization_id = public.current_user_org_id() and public.current_user_is_staff());

drop policy if exists "Admins can delete departments in their organization" on public.departments;
create policy "Admins can delete departments in their organization"
  on public.departments for delete
  to authenticated
  using (organization_id = public.current_user_org_id() and public.current_user_is_staff());

-- Sessions: staff only (protocol members use the protocol RPCs).
drop policy if exists "Admins can view sessions in their organization" on public.attendance_sessions;
create policy "Admins can view sessions in their organization"
  on public.attendance_sessions for select
  to authenticated
  using (organization_id = public.current_user_org_id() and public.current_user_is_staff());

drop policy if exists "Admins can insert sessions in their organization" on public.attendance_sessions;
create policy "Admins can insert sessions in their organization"
  on public.attendance_sessions for insert
  to authenticated
  with check (organization_id = public.current_user_org_id() and public.current_user_is_staff());

drop policy if exists "Admins can update sessions in their organization" on public.attendance_sessions;
create policy "Admins can update sessions in their organization"
  on public.attendance_sessions for update
  to authenticated
  using (organization_id = public.current_user_org_id() and public.current_user_is_staff())
  with check (organization_id = public.current_user_org_id() and public.current_user_is_staff());

drop policy if exists "Admins can delete sessions in their organization" on public.attendance_sessions;
create policy "Admins can delete sessions in their organization"
  on public.attendance_sessions for delete
  to authenticated
  using (organization_id = public.current_user_org_id() and public.current_user_is_staff());

-- Records: staff read/delete. Direct INSERT is removed so that every record is
-- created through a validated RPC that enforces the session window, GPS or
-- protocol authorization, form validation and duplicate prevention.
drop policy if exists "Admins can view records in their organization" on public.attendance_records;
create policy "Admins can view records in their organization"
  on public.attendance_records for select
  to authenticated
  using (organization_id = public.current_user_org_id() and public.current_user_is_staff());

drop policy if exists "Admins can insert records in their organization" on public.attendance_records;

drop policy if exists "Admins can delete records in their organization" on public.attendance_records;
create policy "Admins can delete records in their organization"
  on public.attendance_records for delete
  to authenticated
  using (organization_id = public.current_user_org_id() and public.current_user_is_staff());

-- ----------------------------------------------------------------------------
-- 14. Realtime (analytics and records refresh automatically)
-- ----------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.attendance_records;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.attendance_sessions;
    exception when duplicate_object then null;
    end;
  end if;
end;
$$;
