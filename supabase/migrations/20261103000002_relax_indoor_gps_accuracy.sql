-- ============================================================================
-- MIGRATION: 20261103000002_relax_indoor_gps_accuracy.sql
-- PURPOSE: Relax GPS accuracy threshold for indoor church auditoriums
-- Concrete roofs and walls cause normal smartphone GPS drift (80m–200m).
-- Setting the default threshold to 250m prevents false "Weak GPS" rejections.
-- ============================================================================

-- 1. Update organizations table default and existing values
alter table public.organizations
  alter column gps_accuracy_threshold_m set default 250;

update public.organizations
set gps_accuracy_threshold_m = 250
where gps_accuracy_threshold_m is null or gps_accuracy_threshold_m <= 50;

-- 2. Update attendance_sessions table default and existing sessions
alter table public.attendance_sessions
  alter column gps_accuracy_threshold_m set default 250;

update public.attendance_sessions
set gps_accuracy_threshold_m = 250
where gps_accuracy_threshold_m is null or gps_accuracy_threshold_m <= 50;

-- 3. Re-declare submit_gps_attendance with 250m indoor fallback
create or replace function public.submit_gps_attendance(
  p_token text,
  p_full_name text,
  p_department_id text default null,
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
  v_dept_uuid uuid;
  v_dept_snapshot text;
  v_custom_dept text;
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

  -- Fetch session by token (supports persistent tokens or legacy qr_token)
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

  -- Relaxed indoor GPS accuracy check (defaults to 250m)
  if p_accuracy is not null and p_accuracy > v_threshold then
    return jsonb_build_object(
      'outcome', 'poor-accuracy',
      'accuracyM', round(p_accuracy)::integer,
      'accuracyThresholdM', v_threshold
    );
  end if;

  -- Permitted radius check
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

  -- 4. Resolve Department
  if p_department_id is not null and p_department_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_dept_uuid := p_department_id::uuid;
    select name into v_dept_snapshot from public.departments where id = v_dept_uuid and organization_id = v_session.organization_id;
  end if;

  if v_dept_snapshot is null then
    if p_department_id is not null and trim(p_department_id) != '' and lower(p_department_id) != 'congregation' then
      v_dept_snapshot := trim(p_department_id);
      v_custom_dept := trim(p_department_id);
    else
      v_dept_snapshot := 'Congregation';
    end if;
  end if;

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
    v_dept_uuid,
    v_dept_snapshot,
    v_custom_dept,
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
