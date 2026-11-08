-- ============================================================================
-- MIGRATION: 20261108000004_protocol_extended_close_time.sql
-- PURPOSE: Full support for Protocol QR extended closing time.
--          1. Adds protocol_end_time column to attendance_sessions.
--          2. Updates ln_session_window_state to use protocol_end_time for protocol QR.
--          3. Updates ln_session_payload so the frontend displays the protocol closing time.
--          4. Updates get_public_session_by_token so Protocol QR opens even after GPS QR closes.
--          5. Updates submit_protocol_attendance to allow submissions until protocol_end_time.
-- ============================================================================

-- 1. Add optional protocol_end_time column
alter table public.attendance_sessions
  add column if not exists protocol_end_time time default null;

-- 2. Update ln_session_window_state to support access_type (protocol vs general)
create or replace function public.ln_session_window_state(
  p_session public.attendance_sessions,
  p_access_type text default 'general'
)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_effective_close timestamptz;
begin
  if p_session.status in ('closed', 'expired') then
    return 'closed';
  end if;

  if now() < p_session.opens_at then
    return 'not-open';
  end if;

  -- For protocol tokens, use protocol_end_time if configured, else fall back to normal closes_at
  if p_access_type = 'protocol' and p_session.protocol_end_time is not null then
    v_effective_close := (p_session.session_date + p_session.protocol_end_time) at time zone coalesce(p_session.timezone, 'Africa/Lagos');
  else
    v_effective_close := p_session.closes_at;
  end if;

  if now() >= v_effective_close then
    return 'closed';
  end if;

  return 'open';
end;
$$;

-- Keep 1-parameter signature for any internal callers
create or replace function public.ln_session_window_state(
  p_session public.attendance_sessions
)
returns text
language sql
stable
set search_path = public
as $$
  select public.ln_session_window_state(p_session, 'general');
$$;

-- 3. Update ln_session_payload so protocol QR displays its own extended closing time
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
  v_effective_end_time time;
  v_effective_closes_at timestamptz;
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

  if p_access_type = 'protocol' and p_session.protocol_end_time is not null then
    v_effective_end_time := p_session.protocol_end_time;
    v_effective_closes_at := (p_session.session_date + p_session.protocol_end_time) at time zone coalesce(p_session.timezone, 'Africa/Lagos');
  else
    v_effective_end_time := p_session.end_time;
    v_effective_closes_at := p_session.closes_at;
  end if;

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
      'endTime', to_char(v_effective_end_time, 'HH24:MI'),
      'opensAt', p_session.opens_at,
      'closesAt', v_effective_closes_at,
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
      'accuracyThresholdM', coalesce(p_session.gps_accuracy_threshold_m, v_org.gps_accuracy_threshold_m, 250)
    )
  );
end;
$$;

-- 4. Update get_public_session_by_token to evaluate window state by access_type
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
  v_state text;
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

  v_state := public.ln_session_window_state(v_session, v_token.access_type);

  return public.ln_session_payload(v_session, v_state, v_token.access_type);
end;
$$;

grant execute on function public.get_public_session_by_token(text) to anon, authenticated;

-- 5. Update submit_protocol_attendance to allow submissions until protocol_end_time
drop function if exists public.submit_protocol_attendance(text, text, text, text, jsonb);

create or replace function public.submit_protocol_attendance(
  p_token             text,
  p_full_name         text,
  p_department_id     text    default null,
  p_custom_department text    default null,
  p_responses         jsonb   default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session          public.attendance_sessions%rowtype;
  v_org              public.organizations%rowtype;
  v_local_now        timestamp;
  v_local_date       date;
  v_local_time       time;
  v_effective_end    time;
  v_clean_name       text;
  v_normalized_name  text;
  v_dept_info        jsonb;
  v_existing         public.attendance_records%rowtype;
  v_inserted         public.attendance_records%rowtype;
begin
  if p_token is null or trim(p_token) = '' then
    return jsonb_build_object('outcome', 'invalid-qr');
  end if;

  v_clean_name := trim(regexp_replace(coalesce(p_full_name, ''), '\s+', ' ', 'g'));
  if length(v_clean_name) < 2 then
    return jsonb_build_object('outcome', 'validation-error', 'message', 'Full name must be at least 2 characters.');
  end if;
  v_normalized_name := lower(v_clean_name);

  -- Fetch session by token
  select s.*
  into v_session
  from public.attendance_sessions s
  left join public.session_access_tokens sat on sat.session_id = s.id and sat.revoked_at is null
  where (lower(s.qr_token) = lower(trim(p_token)) or lower(sat.token) = lower(trim(p_token)))
  limit 1;

  if not found then
    return jsonb_build_object('outcome', 'invalid-qr');
  end if;

  select * into v_org from public.organizations where id = v_session.organization_id;

  -- Use protocol_end_time if set, otherwise standard end_time
  v_effective_end := coalesce(v_session.protocol_end_time, v_session.end_time);

  v_local_now  := timezone(coalesce(v_org.timezone, 'Africa/Lagos'), now());
  v_local_date := v_local_now::date;
  v_local_time := v_local_now::time;

  if v_session.status = 'closed' or v_session.status = 'expired' then
    return jsonb_build_object('outcome', 'closed');
  end if;

  if v_local_date < v_session.session_date or (v_local_date = v_session.session_date and v_local_time < v_session.start_time) then
    return jsonb_build_object('outcome', 'not-open');
  end if;

  if v_local_date > v_session.session_date or (v_local_date = v_session.session_date and v_local_time > v_effective_end) then
    return jsonb_build_object('outcome', 'closed');
  end if;

  -- Duplicate prevention
  select *
  into v_existing
  from public.attendance_records
  where session_id = v_session.id
    and normalized_name = v_normalized_name
  limit 1;

  if found then
    return jsonb_build_object(
      'outcome', 'duplicate',
      'message', 'You have already checked in to this session.',
      'record', jsonb_build_object(
        'id',                 v_existing.id,
        'fullName',           v_existing.full_name,
        'departmentName',     v_existing.department_name_snapshot,
        'isCustomDepartment', v_existing.custom_department is not null,
        'submittedAt',        v_existing.submitted_at,
        'verificationMethod', v_existing.verification_method
      )
    );
  end if;

  -- Resolve Department
  begin
    v_dept_info := public.ln_resolve_department(v_session, p_department_id, p_custom_department);
  exception when others then
    return jsonb_build_object('outcome', 'validation-error', 'message', sqlerrm);
  end;

  -- Insert Record (protocol_verified)
  insert into public.attendance_records (
    organization_id,
    session_id,
    full_name,
    department_id,
    department_name_snapshot,
    custom_department,
    source,
    verification_method,
    responses
  ) values (
    v_session.organization_id,
    v_session.id,
    v_clean_name,
    (v_dept_info ->> 'departmentId')::uuid,
    v_dept_info ->> 'departmentName',
    v_dept_info ->> 'customDepartment',
    'qr-web',
    'protocol_verified',
    coalesce(p_responses, '{}'::jsonb)
  )
  returning * into v_inserted;

  return jsonb_build_object(
    'outcome', 'success',
    'record', jsonb_build_object(
      'id',                 v_inserted.id,
      'fullName',           v_inserted.full_name,
      'departmentName',     v_inserted.department_name_snapshot,
      'isCustomDepartment', v_inserted.custom_department is not null,
      'submittedAt',        v_inserted.submitted_at,
      'verificationMethod', 'protocol_verified'
    )
  );
end;
$$;

grant execute on function public.submit_protocol_attendance(text, text, text, text, jsonb) to anon, authenticated;
