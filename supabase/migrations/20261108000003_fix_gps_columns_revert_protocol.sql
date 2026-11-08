-- ============================================================================
-- MIGRATION: 20261108000003_fix_gps_columns_revert_protocol.sql
-- PURPOSE:
--   1. Add missing gps_latitude / gps_longitude columns to attendance_records
--      (the GPS function tries to INSERT these but they were never created).
--   2. Revert submit_protocol_attendance back to no-location version
--      (undoes migration 20261108000002 which added location check to protocol).
-- ============================================================================

-- 1. Add missing GPS coordinate columns (safe to re-run)
alter table public.attendance_records
  add column if not exists gps_latitude  double precision,
  add column if not exists gps_longitude double precision;

-- 2. Revert submit_protocol_attendance to no-location version.
--    Drop any overloaded signatures first, then recreate the clean 5-param version.
drop function if exists public.submit_protocol_attendance(text, text, text, text, jsonb, double precision, double precision, double precision);
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

  -- Time restriction check
  v_local_now  := timezone(coalesce(v_org.timezone, 'Africa/Lagos'), now());
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

  -- Insert Record (no GPS columns — protocol does not require location)
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
