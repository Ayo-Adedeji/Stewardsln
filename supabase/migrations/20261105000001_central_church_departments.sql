-- ============================================================================
-- MIGRATION: 20261105000001_central_church_departments.sql
-- PURPOSE:
-- 1. Seed the 14 official Light Nation church departments centrally in database
-- 2. Enforce case-insensitive and whitespace-trimmed uniqueness to prevent duplicates
-- 3. Auto-seed trigger for newly created organizations
-- 4. Central department resolution: validate against active database departments,
--    disallowing arbitrary free-text department submissions.
-- ============================================================================

-- 1. Reconcile and Seed Official Departments safely (handles any pre-existing rows or manual admin entries)
do $$
declare
  v_org record;
  dept_item record;
  v_match_id uuid;
begin
  for dept_item in (
    select * from (
      values
        ('Media Army', 'MEDIA', 'Audio-visual production, livestream, sound engineering, and media coverage.', 'Media Lead', 60),
        ('Protocol', 'PROT', 'General protocol, service orderliness, guest reception, and entrance check-in.', 'Protocol Lead', 0),
        ('Pastors'' Protocol', 'PAST-P', 'Pastoral care, ministerial assistance, and executive protocol.', 'Pastoral Protocol Lead', 0),
        ('Streams of Life', 'SOL', 'Streams of Life worship ministry, music, and choir.', 'Music Director', 100),
        ('Prayer Unit', 'PRAY', 'Intercession, pre-service prayer coordinators, and prayer chains.', 'Prayer Secretary', 100),
        ('Sanitation Department', 'SAN', 'Sanctuary upkeep, auditorium cleanliness, and facility hygiene.', 'Sanitation Lead', 0),
        ('Follow-up Unit', 'FLW', 'First-timer integration, convert follow-up, and member retention.', 'Follow-up Coordinator', 0),
        ('Children''s Department', 'CHLD', 'Children''s church teachers, coordinators, and age-grade educators.', 'Children Coordinator', 0),
        ('Hospitality Department', 'HOSP', 'Guest hospitality, minister care, refreshments, and welcoming team.', 'Hospitality Head', 0),
        ('Welfare Department', 'WELF', 'Benevolence, member assistance, outreach, and community welfare.', 'Welfare Lead', 0),
        ('Marshal Department', 'MRSH', 'Auditorium marshaling, security surveillance, and crowd management.', 'Chief Marshal', 0),
        ('Maintenance Department', 'MAINT', 'Electrical, mechanical, structural facilities, and equipment repairs.', 'Maintenance Lead', 0),
        ('Christos Army', 'CARMY', 'Christos Army evangelism, discipleship, and community outreach ministry unit.', 'Ministry Lead', 100),
        ('Philips Company', 'PHIL', 'Technical partner and production engineering unit.', 'Unit Coordinator', 0)
    ) as t(name, code, description, lead_name, member_count)
  ) loop
    for v_org in select id from public.organizations loop
      -- Look for existing row by code, normalized name, or known aliases
      select id into v_match_id
      from public.departments
      where organization_id = v_org.id
        and (
          upper(trim(code)) = upper(trim(dept_item.code))
          or lower(trim(regexp_replace(name, '\s+', ' ', 'g'))) = lower(trim(regexp_replace(dept_item.name, '\s+', ' ', 'g')))
          or (dept_item.code = 'MEDIA' and lower(trim(name)) in ('media army', 'media department', 'media'))
          or (dept_item.code = 'CARMY' and lower(trim(name)) in ('christos army', 'christos department', 'christos'))
          or (dept_item.code = 'PRAY' and lower(trim(name)) in ('prayer unit', 'prayer units', 'prayer department', 'prayer'))
          or (dept_item.code = 'SOL' and lower(trim(name)) in ('streams of life', 'streams'))
        )
      order by created_at asc
      limit 1;

      if v_match_id is not null then
        -- Update matched existing row to official name and code, preserving non-zero member counts
        update public.departments
        set name = dept_item.name,
            code = dept_item.code,
            description = coalesce(nullif(description, ''), dept_item.description),
            lead_name = coalesce(nullif(lead_name, ''), dept_item.lead_name),
            enabled = true,
            member_count = case when member_count > 0 then member_count else dept_item.member_count end
        where id = v_match_id;

        -- Re-point any attendance records pointing to other duplicates
        update public.attendance_records
        set department_id = v_match_id
        where department_id in (
          select d.id
          from public.departments d
          where d.organization_id = v_org.id
            and d.id <> v_match_id
            and (
              upper(trim(d.code)) = upper(trim(dept_item.code))
              or lower(trim(regexp_replace(d.name, '\s+', ' ', 'g'))) = lower(trim(regexp_replace(dept_item.name, '\s+', ' ', 'g')))
            )
        );

        -- Delete duplicate department rows
        delete from public.departments
        where organization_id = v_org.id
          and id <> v_match_id
          and (
            upper(trim(code)) = upper(trim(dept_item.code))
            or lower(trim(regexp_replace(name, '\s+', ' ', 'g'))) = lower(trim(regexp_replace(dept_item.name, '\s+', ' ', 'g')))
          );
      else
        -- Insert department row
        insert into public.departments (organization_id, name, code, description, lead_name, enabled, member_count)
        values (v_org.id, dept_item.name, dept_item.code, dept_item.description, dept_item.lead_name, true, dept_item.member_count);
      end if;
    end loop;
  end loop;
end $$;

-- 2. Unique case-insensitive & whitespace-trimmed index on department names and codes
create unique index if not exists idx_departments_unique_norm_name
on public.departments (organization_id, lower(trim(regexp_replace(name, '\s+', ' ', 'g'))));

create unique index if not exists idx_departments_unique_norm_code
on public.departments (organization_id, upper(trim(code)));

-- 3. Trigger function to auto-seed departments when a new organization is created
create or replace function public.seed_new_organization_departments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.departments (organization_id, name, code, description, lead_name, enabled, member_count)
  values
    (new.id, 'Media Army', 'MEDIA', 'Audio-visual production, livestream, sound engineering, and media coverage.', 'Media Lead', true, 0),
    (new.id, 'Protocol', 'PROT', 'General protocol, service orderliness, guest reception, and entrance check-in.', 'Protocol Lead', true, 0),
    (new.id, 'Pastors'' Protocol', 'PAST-P', 'Pastoral care, ministerial assistance, and executive protocol.', 'Pastoral Protocol Lead', true, 0),
    (new.id, 'Streams of Life', 'SOL', 'Streams of Life worship ministry, music, and choir.', 'Music Director', true, 0),
    (new.id, 'Prayer Unit', 'PRAY', 'Intercession, pre-service prayer coordinators, and prayer chains.', 'Prayer Secretary', true, 0),
    (new.id, 'Sanitation Department', 'SAN', 'Sanctuary upkeep, auditorium cleanliness, and facility hygiene.', 'Sanitation Lead', true, 0),
    (new.id, 'Follow-up Unit', 'FLW', 'First-timer integration, convert follow-up, and member retention.', 'Follow-up Coordinator', true, 0),
    (new.id, 'Children''s Department', 'CHLD', 'Children''s church teachers, coordinators, and age-grade educators.', 'Children Coordinator', true, 0),
    (new.id, 'Hospitality Department', 'HOSP', 'Guest hospitality, minister care, refreshments, and welcoming team.', 'Hospitality Head', true, 0),
    (new.id, 'Welfare Department', 'WELF', 'Benevolence, member assistance, outreach, and community welfare.', 'Welfare Lead', true, 0),
    (new.id, 'Marshal Department', 'MRSH', 'Auditorium marshaling, security surveillance, and crowd management.', 'Chief Marshal', true, 0),
    (new.id, 'Maintenance Department', 'MAINT', 'Electrical, mechanical, structural facilities, and equipment repairs.', 'Maintenance Lead', true, 0),
    (new.id, 'Christos Army', 'CARMY', 'Christos Army evangelism, discipleship, and community outreach ministry unit.', 'Ministry Lead', true, 100),
    (new.id, 'Philips Company', 'PHIL', 'Technical partner and production engineering unit.', 'Unit Coordinator', true, 0)
  on conflict (organization_id, code) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_seed_organization_departments on public.organizations;
create trigger trg_seed_organization_departments
  after insert on public.organizations
  for each row execute function public.seed_new_organization_departments();

-- 4. Central Department Resolution Function
--    Strictly validates against active central database departments.
--    Does not allow arbitrary free-text department entry.
create or replace function public.ln_resolve_department(
  p_session public.attendance_sessions,
  p_department_id text
)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_field jsonb;
  v_choice text := lower(trim(coalesce(p_department_id, '')));
  v_required boolean;
  v_dept public.departments%rowtype;
begin
  -- Check if form schema collects department
  select f into v_field
  from jsonb_array_elements(p_session.form_schema -> 'fields') f
  where f ->> 'type' = 'department'
  limit 1;

  if v_field is null then
    return jsonb_build_object('departmentId', null, 'departmentName', 'Not collected');
  end if;

  v_required := coalesce((v_field ->> 'required')::boolean, false);

  if v_choice = '' then
    if v_required then
      raise exception 'Please select your department from the dropdown.';
    end if;
    return jsonb_build_object('departmentId', null, 'departmentName', 'Not specified');
  end if;

  if v_choice = 'congregation' then
    return jsonb_build_object('departmentId', null, 'departmentName', 'General Congregation');
  end if;

  -- Match against central active departments (by UUID, code, or exact name)
  select * into v_dept
  from public.departments
  where organization_id = p_session.organization_id
    and enabled = true
    and (
      (p_department_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and id = p_department_id::uuid)
      or upper(trim(code)) = upper(trim(p_department_id))
      or lower(trim(name)) = lower(trim(p_department_id))
      or (lower(trim(p_department_id)) in ('media', 'media department', 'media army') and upper(trim(code)) = 'MEDIA')
      or (lower(trim(p_department_id)) in ('christos', 'christos department', 'christos army') and upper(trim(code)) = 'CARMY')
      or (lower(trim(p_department_id)) in ('prayer', 'prayer unit', 'prayer units', 'prayer department') and upper(trim(code)) = 'PRAY')
      or (lower(trim(p_department_id)) in ('streams', 'streams of life') and upper(trim(code)) = 'SOL')
    )
  limit 1;

  if found then
    return jsonb_build_object('departmentId', v_dept.id, 'departmentName', v_dept.name);
  end if;

  raise exception 'Please select a valid department from the dropdown.';
end;
$$;

-- 5. Submit GPS Attendance using central department resolution
create or replace function public.submit_gps_attendance(
  p_token text,
  p_full_name text,
  p_department_id text default null,
  p_custom_department text default null,
  p_responses jsonb default '{}'::jsonb,
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
  v_session public.attendance_sessions%rowtype;
  v_org public.organizations%rowtype;
  v_local_now timestamp;
  v_local_date date;
  v_local_time time;
  v_clean_name text;
  v_normalized_name text;
  v_dept_info jsonb;
  v_existing public.attendance_records%rowtype;
  v_inserted public.attendance_records%rowtype;
  v_lat double precision;
  v_lng double precision;
  v_radius integer;
  v_threshold integer;
  v_distance double precision;
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

  -- 1. Time restriction check (Africa/Lagos)
  v_local_now := timezone(coalesce(v_org.timezone, 'Africa/Lagos'), now());
  v_local_date := v_local_now::date;
  v_local_time := v_local_now::time;

  if v_session.status = 'closed' or v_session.status = 'expired' then
    return jsonb_build_object('outcome', 'closed');
  end if;

  if v_local_date < v_session.session_date or (v_local_date = v_session.session_date and v_local_time < v_session.start_time) then
    return jsonb_build_object('outcome', 'not-open');
  end if;

  if v_local_date > v_session.session_date or (v_local_date = v_session.session_date and v_local_time > v_session.end_time) then
    return jsonb_build_object('outcome', 'closed');
  end if;

  -- 2. GPS Geofence & Accuracy Verification
  v_lat := coalesce(v_session.geofence_latitude, v_org.geofence_latitude);
  v_lng := coalesce(v_session.geofence_longitude, v_org.geofence_longitude);
  v_radius := coalesce(v_session.geofence_radius_m, v_org.geofence_radius_m, 100);
  v_threshold := coalesce(v_session.gps_accuracy_threshold_m, v_org.gps_accuracy_threshold_m, 250);

  if v_lat is null or v_lng is null then
    return jsonb_build_object('outcome', 'location-not-configured');
  end if;

  if p_latitude is null or p_longitude is null then
    return jsonb_build_object('outcome', 'location-required');
  end if;

  v_distance := public.haversine_distance_m(v_lat, v_lng, p_latitude, p_longitude);

  if p_accuracy is not null and p_accuracy > v_threshold then
    return jsonb_build_object(
      'outcome', 'poor-accuracy',
      'accuracyM', round(p_accuracy)::integer,
      'accuracyThresholdM', v_threshold
    );
  end if;

  if v_distance > v_radius then
    return jsonb_build_object(
      'outcome', 'outside-geofence',
      'distanceM', round(v_distance)::integer,
      'radiusM', v_radius
    );
  end if;

  -- 3. Duplicate Prevention
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
        'id', v_existing.id,
        'fullName', v_existing.full_name,
        'departmentName', v_existing.department_name_snapshot,
        'submittedAt', v_existing.submitted_at,
        'verificationMethod', v_existing.verification_method
      )
    );
  end if;

  -- 4. Resolve Department from central active list
  begin
    v_dept_info := public.ln_resolve_department(v_session, coalesce(p_department_id, p_custom_department));
  exception when others then
    return jsonb_build_object('outcome', 'validation-error', 'message', sqlerrm);
  end;

  -- 5. Insert Record
  insert into public.attendance_records (
    organization_id,
    session_id,
    full_name,
    department_id,
    department_name_snapshot,
    custom_department,
    source,
    verification_method,
    responses,
    gps_latitude,
    gps_longitude,
    gps_distance_m,
    gps_accuracy_m
  ) values (
    v_session.organization_id,
    v_session.id,
    v_clean_name,
    (v_dept_info ->> 'departmentId')::uuid,
    v_dept_info ->> 'departmentName',
    null,
    'qr-web',
    'gps_verified',
    coalesce(p_responses, '{}'::jsonb),
    p_latitude,
    p_longitude,
    round(v_distance)::integer,
    round(coalesce(p_accuracy, 0))::integer
  )
  returning * into v_inserted;

  return jsonb_build_object(
    'outcome', 'success',
    'record', jsonb_build_object(
      'id', v_inserted.id,
      'fullName', v_inserted.full_name,
      'departmentName', v_inserted.department_name_snapshot,
      'submittedAt', v_inserted.submitted_at,
      'verificationMethod', 'gps_verified',
      'distanceM', round(v_distance)::integer,
      'accuracyM', round(coalesce(p_accuracy, 0))::integer
    )
  );
end;
$$;

-- 6. Submit Protocol Attendance using central department resolution
create or replace function public.submit_protocol_attendance(
  p_token text,
  p_full_name text,
  p_department_id text default null,
  p_custom_department text default null,
  p_responses jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.attendance_sessions%rowtype;
  v_org public.organizations%rowtype;
  v_local_now timestamp;
  v_local_date date;
  v_local_time time;
  v_clean_name text;
  v_normalized_name text;
  v_dept_info jsonb;
  v_existing public.attendance_records%rowtype;
  v_inserted public.attendance_records%rowtype;
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

  -- 1. STRICT Time restriction check (Protocol QR CANNOT bypass opening or closing time)
  v_local_now := timezone(coalesce(v_org.timezone, 'Africa/Lagos'), now());
  v_local_date := v_local_now::date;
  v_local_time := v_local_now::time;

  if v_session.status = 'closed' or v_session.status = 'expired' then
    return jsonb_build_object('outcome', 'closed');
  end if;

  if v_local_date < v_session.session_date or (v_local_date = v_session.session_date and v_local_time < v_session.start_time) then
    return jsonb_build_object('outcome', 'not-open');
  end if;

  if v_local_date > v_session.session_date or (v_local_date = v_session.session_date and v_local_time > v_session.end_time) then
    return jsonb_build_object('outcome', 'closed');
  end if;

  -- 2. Duplicate Prevention
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
        'id', v_existing.id,
        'fullName', v_existing.full_name,
        'departmentName', v_existing.department_name_snapshot,
        'submittedAt', v_existing.submitted_at,
        'verificationMethod', v_existing.verification_method
      )
    );
  end if;

  -- 3. Resolve Department from central active list
  begin
    v_dept_info := public.ln_resolve_department(v_session, coalesce(p_department_id, p_custom_department));
  exception when others then
    return jsonb_build_object('outcome', 'validation-error', 'message', sqlerrm);
  end;

  -- 4. Insert Record (protocol_verified)
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
    null,
    'qr-web',
    'protocol_verified',
    coalesce(p_responses, '{}'::jsonb)
  )
  returning * into v_inserted;

  return jsonb_build_object(
    'outcome', 'success',
    'record', jsonb_build_object(
      'id', v_inserted.id,
      'fullName', v_inserted.full_name,
      'departmentName', v_inserted.department_name_snapshot,
      'submittedAt', v_inserted.submitted_at,
      'verificationMethod', 'protocol_verified'
    )
  );
end;
$$;
