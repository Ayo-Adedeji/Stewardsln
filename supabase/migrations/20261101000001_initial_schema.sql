-- ============================================================================
-- Light Nation Church Attendance Management System
-- Initial Production Schema, RLS Policies, Triggers & Security Definer RPCs
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. Core Tables
-- ----------------------------------------------------------------------------

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  branch text not null,
  slug text not null unique,
  timezone text not null default 'Africa/Lagos',
  default_duration_minutes integer not null default 180 check (default_duration_minutes >= 15 and default_duration_minutes <= 720),
  allow_other_department_by_default boolean not null default true,
  public_base_url text not null default 'http://localhost:3000',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text not null default '',
  role text not null default 'super_admin' check (role in ('super_admin', 'admin', 'coordinator')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null default 'admin' check (role in ('admin', 'coordinator')),
  token text not null unique default (replace(gen_random_uuid()::text, '-', '') || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)),
  invited_by uuid references public.admin_profiles(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.ownership_transfer_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  previous_super_admin_id uuid references public.admin_profiles(id) on delete set null,
  previous_super_admin_name text not null,
  previous_super_admin_email text not null,
  new_super_admin_id uuid references public.admin_profiles(id) on delete set null,
  new_super_admin_name text not null,
  new_super_admin_email text not null,
  previous_admin_new_role text not null check (previous_admin_new_role in ('admin', 'coordinator')),
  reason text not null default '',
  transferred_at timestamptz not null default now()
);

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  code text not null,
  lead_name text not null default '',
  description text not null default '',
  enabled boolean not null default true,
  member_count integer not null default 0 check (member_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table if not exists public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  category text not null default 'General Service',
  session_date date not null,
  start_time time not null,
  end_time time not null,
  qr_token text not null unique default ('ln-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)),
  status text not null default 'upcoming' check (status in ('active', 'upcoming', 'closed', 'expired')),
  location text not null default 'Main Auditorium',
  notes text not null default '',
  allow_other_department boolean not null default true,
  expected_capacity integer not null default 100 check (expected_capacity >= 1),
  registration_count integer not null default 0 check (registration_count >= 0),
  created_by uuid references public.admin_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  full_name text not null,
  normalized_name text generated always as (lower(trim(regexp_replace(full_name, '\s+', ' ', 'g')))) stored,
  department_id uuid references public.departments(id) on delete set null,
  department_name_snapshot text not null,
  custom_department text,
  source text not null default 'qr-web' check (source in ('qr-web', 'admin-manual')),
  submitted_at timestamptz not null default now(),
  unique (session_id, normalized_name)
);

-- ----------------------------------------------------------------------------
-- 2. Indexes
-- ----------------------------------------------------------------------------

create index if not exists idx_admin_profiles_org on public.admin_profiles(organization_id);
create index if not exists idx_admin_invitations_org on public.admin_invitations(organization_id);
create index if not exists idx_admin_invitations_email on public.admin_invitations(lower(email));
create index if not exists idx_ownership_transfer_logs_org on public.ownership_transfer_logs(organization_id, transferred_at desc);
create index if not exists idx_departments_org_enabled on public.departments(organization_id, enabled);
create index if not exists idx_sessions_org_date on public.attendance_sessions(organization_id, session_date desc);
create index if not exists idx_sessions_org_status on public.attendance_sessions(organization_id, status);
create index if not exists idx_records_session_submitted on public.attendance_records(session_id, submitted_at desc);
create index if not exists idx_records_org_submitted on public.attendance_records(organization_id, submitted_at desc);
create index if not exists idx_records_dept on public.attendance_records(department_id);

-- ----------------------------------------------------------------------------
-- 3. Utility Triggers (updated_at & session registration_count maintenance)
-- ----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_organizations_updated_at on public.organizations;
create trigger trg_organizations_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

drop trigger if exists trg_admin_profiles_updated_at on public.admin_profiles;
create trigger trg_admin_profiles_updated_at
  before update on public.admin_profiles
  for each row execute function public.set_updated_at();

create or replace function public.enforce_admin_profile_security()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bypass boolean := coalesce(current_setting('app.bypass_role_guard', true), 'false') = 'true';
  v_remaining_super_admins integer;
  v_org_exists boolean;
begin
  if tg_op = 'UPDATE' then
    -- Prevent direct client updates from altering role, active status, email, or organization
    if not v_bypass then
      if new.role is distinct from old.role then
        raise exception 'Administrator roles can only be changed through authorized Super Admin governance actions.';
      end if;
      if new.is_active is distinct from old.is_active then
        raise exception 'Administrator active status can only be changed by an active Super Administrator.';
      end if;
      if new.organization_id is distinct from old.organization_id then
        raise exception 'Organization membership cannot be modified.';
      end if;
      if lower(new.email) is distinct from lower(old.email) then
        raise exception 'Administrator email address cannot be modified directly.';
      end if;
    end if;

    -- Guarantee at least one active Super Admin remains in the organization
    if old.role = 'super_admin' and old.is_active = true and (new.role <> 'super_admin' or new.is_active = false) then
      select count(*)::integer
      into v_remaining_super_admins
      from public.admin_profiles
      where organization_id = old.organization_id
        and role = 'super_admin'
        and is_active = true
        and id <> old.id;

      if v_remaining_super_admins < 1 then
        raise exception 'Every organization must have at least one active Super Administrator. Transfer Super Admin ownership to another active administrator first.';
      end if;
    end if;

    return new;
  elsif tg_op = 'DELETE' then
    select exists(select 1 from public.organizations where id = old.organization_id)
    into v_org_exists;

    if v_org_exists and old.role = 'super_admin' and old.is_active = true then
      select count(*)::integer
      into v_remaining_super_admins
      from public.admin_profiles
      where organization_id = old.organization_id
        and role = 'super_admin'
        and is_active = true
        and id <> old.id;

      if v_remaining_super_admins < 1 then
        raise exception 'Cannot delete the sole active Super Administrator of an organization. Transfer ownership first.';
      end if;
    end if;

    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_enforce_admin_profile_security on public.admin_profiles;
create trigger trg_enforce_admin_profile_security
  before update or delete on public.admin_profiles
  for each row execute function public.enforce_admin_profile_security();

drop trigger if exists trg_departments_updated_at on public.departments;
create trigger trg_departments_updated_at
  before update on public.departments
  for each row execute function public.set_updated_at();

drop trigger if exists trg_attendance_sessions_updated_at on public.attendance_sessions;
create trigger trg_attendance_sessions_updated_at
  before update on public.attendance_sessions
  for each row execute function public.set_updated_at();

create or replace function public.sync_session_registration_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.attendance_sessions
    set registration_count = (
      select count(*)::integer
      from public.attendance_records
      where session_id = new.session_id
    )
    where id = new.session_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.attendance_sessions
    set registration_count = (
      select count(*)::integer
      from public.attendance_records
      where session_id = old.session_id
    )
    where id = old.session_id;
    return old;
  elsif tg_op = 'UPDATE' and new.session_id is distinct from old.session_id then
    update public.attendance_sessions
    set registration_count = (
      select count(*)::integer
      from public.attendance_records
      where session_id = old.session_id
    )
    where id = old.session_id;

    update public.attendance_sessions
    set registration_count = (
      select count(*)::integer
      from public.attendance_records
      where session_id = new.session_id
    )
    where id = new.session_id;
    return new;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_sync_session_registration_count on public.attendance_records;
create trigger trg_sync_session_registration_count
  after insert or update or delete on public.attendance_records
  for each row execute function public.sync_session_registration_count();

-- ----------------------------------------------------------------------------
-- 4. Auth Trigger: Enforce First-Admin Setup or Invitation-Only Registration
-- ----------------------------------------------------------------------------

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_count integer;
  v_is_first_setup boolean;
  v_invite_token text;
  v_invitation public.admin_invitations%rowtype;
  v_org_id uuid;
  v_church_name text;
  v_branch_name text;
  v_full_name text;
  v_phone text;
  v_public_base_url text;
  v_slug text;
begin
  lock table public.admin_profiles in exclusive mode;

  select count(*)::integer into v_admin_count from public.admin_profiles;
  v_is_first_setup := coalesce((new.raw_user_meta_data->>'setup_first_admin')::boolean, false);
  v_invite_token := nullif(trim(coalesce(new.raw_user_meta_data->>'invite_token', '')), '');
  v_full_name := coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1));
  v_phone := coalesce(trim(new.raw_user_meta_data->>'phone'), '');

  if v_admin_count = 0 then
    -- First administrator bootstrap
    v_church_name := coalesce(nullif(trim(new.raw_user_meta_data->>'church_name'), ''), 'Light Nation');
    v_branch_name := coalesce(nullif(trim(new.raw_user_meta_data->>'branch_name'), ''), 'Ibadan');
    v_public_base_url := coalesce(nullif(trim(new.raw_user_meta_data->>'public_base_url'), ''), 'http://localhost:3000');
    v_slug := lower(regexp_replace(v_church_name || '-' || v_branch_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

    insert into public.organizations (
      name,
      branch,
      slug,
      timezone,
      default_duration_minutes,
      allow_other_department_by_default,
      public_base_url
    ) values (
      v_church_name,
      v_branch_name,
      v_slug,
      'Africa/Lagos',
      180,
      true,
      v_public_base_url
    )
    returning id into v_org_id;

    insert into public.admin_profiles (
      id,
      organization_id,
      full_name,
      email,
      phone,
      role,
      is_active
    ) values (
      new.id,
      v_org_id,
      v_full_name,
      lower(new.email),
      v_phone,
      'super_admin',
      true
    );

    return new;
  end if;

  -- Subsequent users MUST have a valid invitation token
  if v_invite_token is null then
    raise exception 'Public administrator registration is disabled. An active administrator invitation is required.';
  end if;

  select *
  into v_invitation
  from public.admin_invitations
  where token = v_invite_token
    and accepted_at is null
    and expires_at > now()
    and lower(email) = lower(new.email)
  for update;

  if not found then
    raise exception 'Invalid, expired, or email-mismatched administrator invitation token.';
  end if;

  update public.admin_invitations
  set accepted_at = now()
  where id = v_invitation.id;

  insert into public.admin_profiles (
    id,
    organization_id,
    full_name,
    email,
    phone,
    role,
    is_active
  ) values (
    new.id,
    v_invitation.organization_id,
    v_full_name,
    lower(new.email),
    v_phone,
    v_invitation.role,
    true
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ----------------------------------------------------------------------------
-- 5. Row Level Security (RLS) Helpers & Policies
-- ----------------------------------------------------------------------------

create or replace function public.current_user_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id
  from public.admin_profiles
  where id = auth.uid()
    and is_active = true
  limit 1;
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.admin_profiles
  where id = auth.uid()
    and is_active = true
  limit 1;
$$;

alter table public.organizations enable row level security;
alter table public.admin_profiles enable row level security;
alter table public.admin_invitations enable row level security;
alter table public.ownership_transfer_logs enable row level security;
alter table public.departments enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_records enable row level security;

-- Organizations Policies
drop policy if exists "Admins can view their organization" on public.organizations;
create policy "Admins can view their organization"
  on public.organizations for select
  to authenticated
  using (id = public.current_user_org_id());

drop policy if exists "Admins can update their organization" on public.organizations;
create policy "Admins can update their organization"
  on public.organizations for update
  to authenticated
  using (id = public.current_user_org_id() and public.current_user_role() in ('super_admin', 'admin'))
  with check (id = public.current_user_org_id() and public.current_user_role() in ('super_admin', 'admin'));

-- Admin Profiles Policies
drop policy if exists "Admins can view profiles in their organization" on public.admin_profiles;
create policy "Admins can view profiles in their organization"
  on public.admin_profiles for select
  to authenticated
  using (id = auth.uid() or organization_id = public.current_user_org_id());

drop policy if exists "Admins can update their own profile" on public.admin_profiles;
create policy "Admins can update their own profile"
  on public.admin_profiles for update
  to authenticated
  using (
    (id = auth.uid() and is_active = true)
    or coalesce(current_setting('app.bypass_role_guard', true), 'false') = 'true'
  )
  with check (
    (
      id = auth.uid()
      and organization_id = public.current_user_org_id()
      and role = public.current_user_role()
      and is_active = true
    )
    or coalesce(current_setting('app.bypass_role_guard', true), 'false') = 'true'
  );

-- Ownership Transfer Audit Log Policies (Read-only for organization admins; written only by SECURITY DEFINER RPC)
drop policy if exists "Admins can view ownership transfer logs in their organization" on public.ownership_transfer_logs;
create policy "Admins can view ownership transfer logs in their organization"
  on public.ownership_transfer_logs for select
  to authenticated
  using (organization_id = public.current_user_org_id());

drop policy if exists "System RPC can insert ownership transfer logs" on public.ownership_transfer_logs;
create policy "System RPC can insert ownership transfer logs"
  on public.ownership_transfer_logs for insert
  to authenticated
  with check (
    organization_id = public.current_user_org_id()
    and coalesce(current_setting('app.bypass_role_guard', true), 'false') = 'true'
  );

-- Admin Invitations Policies
drop policy if exists "Admins can view invitations in their organization" on public.admin_invitations;
create policy "Admins can view invitations in their organization"
  on public.admin_invitations for select
  to authenticated
  using (organization_id = public.current_user_org_id());

drop policy if exists "Super admins can create invitations" on public.admin_invitations;
create policy "Super admins can create invitations"
  on public.admin_invitations for insert
  to authenticated
  with check (
    organization_id = public.current_user_org_id()
    and public.current_user_role() in ('super_admin', 'admin')
  );

drop policy if exists "Super admins can delete invitations" on public.admin_invitations;
create policy "Super admins can delete invitations"
  on public.admin_invitations for delete
  to authenticated
  using (
    organization_id = public.current_user_org_id()
    and public.current_user_role() in ('super_admin', 'admin')
  );

-- Departments Policies
drop policy if exists "Admins can view departments in their organization" on public.departments;
create policy "Admins can view departments in their organization"
  on public.departments for select
  to authenticated
  using (organization_id = public.current_user_org_id());

drop policy if exists "Admins can insert departments in their organization" on public.departments;
create policy "Admins can insert departments in their organization"
  on public.departments for insert
  to authenticated
  with check (organization_id = public.current_user_org_id());

drop policy if exists "Admins can update departments in their organization" on public.departments;
create policy "Admins can update departments in their organization"
  on public.departments for update
  to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop policy if exists "Admins can delete departments in their organization" on public.departments;
create policy "Admins can delete departments in their organization"
  on public.departments for delete
  to authenticated
  using (organization_id = public.current_user_org_id());

-- Attendance Sessions Policies
drop policy if exists "Admins can view sessions in their organization" on public.attendance_sessions;
create policy "Admins can view sessions in their organization"
  on public.attendance_sessions for select
  to authenticated
  using (organization_id = public.current_user_org_id());

drop policy if exists "Admins can insert sessions in their organization" on public.attendance_sessions;
create policy "Admins can insert sessions in their organization"
  on public.attendance_sessions for insert
  to authenticated
  with check (organization_id = public.current_user_org_id());

drop policy if exists "Admins can update sessions in their organization" on public.attendance_sessions;
create policy "Admins can update sessions in their organization"
  on public.attendance_sessions for update
  to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop policy if exists "Admins can delete sessions in their organization" on public.attendance_sessions;
create policy "Admins can delete sessions in their organization"
  on public.attendance_sessions for delete
  to authenticated
  using (organization_id = public.current_user_org_id());

-- Attendance Records Policies
drop policy if exists "Admins can view records in their organization" on public.attendance_records;
create policy "Admins can view records in their organization"
  on public.attendance_records for select
  to authenticated
  using (organization_id = public.current_user_org_id());

drop policy if exists "Admins can insert records in their organization" on public.attendance_records;
create policy "Admins can insert records in their organization"
  on public.attendance_records for insert
  to authenticated
  with check (organization_id = public.current_user_org_id());

drop policy if exists "Admins can delete records in their organization" on public.attendance_records;
create policy "Admins can delete records in their organization"
  on public.attendance_records for delete
  to authenticated
  using (organization_id = public.current_user_org_id());

-- ----------------------------------------------------------------------------
-- 6. Security Definer RPC Functions (Setup, Invitations & Public QR Check-in)
-- ----------------------------------------------------------------------------

-- 6.1 Check whether initial Super Admin setup is required
create or replace function public.is_initial_setup_required()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (select 1 from public.admin_profiles);
$$;

grant execute on function public.is_initial_setup_required() to anon, authenticated;

-- 6.2 Bootstrap First Admin (idempotent helper if called after auth.signUp)
create or replace function public.bootstrap_first_admin(
  p_church_name text,
  p_branch_name text,
  p_full_name text,
  p_email text,
  p_phone text default '',
  p_public_base_url text default 'http://localhost:3000'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_existing public.admin_profiles%rowtype;
  v_admin_count integer;
  v_org_id uuid;
  v_slug text;
begin
  if v_uid is null then
    raise exception 'Authentication is required to complete administrator setup.';
  end if;

  select * into v_existing from public.admin_profiles where id = v_uid;
  if found then
    update public.organizations
    set
      name = coalesce(nullif(trim(p_church_name), ''), name),
      branch = coalesce(nullif(trim(p_branch_name), ''), branch),
      public_base_url = coalesce(nullif(trim(p_public_base_url), ''), public_base_url)
    where id = v_existing.organization_id;

    update public.admin_profiles
    set
      full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
      phone = coalesce(trim(p_phone), phone)
    where id = v_uid;

    return jsonb_build_object(
      'status', 'ready',
      'organization_id', v_existing.organization_id,
      'admin_id', v_existing.id
    );
  end if;

  lock table public.admin_profiles in exclusive mode;
  select count(*)::integer into v_admin_count from public.admin_profiles;

  if v_admin_count > 0 then
    raise exception 'Initial setup has already been completed. New administrators must be invited.';
  end if;

  v_slug := lower(regexp_replace(coalesce(nullif(trim(p_church_name), ''), 'Light Nation') || '-' || coalesce(nullif(trim(p_branch_name), ''), 'Ibadan'), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

  insert into public.organizations (
    name,
    branch,
    slug,
    timezone,
    default_duration_minutes,
    allow_other_department_by_default,
    public_base_url
  ) values (
    coalesce(nullif(trim(p_church_name), ''), 'Light Nation'),
    coalesce(nullif(trim(p_branch_name), ''), 'Ibadan'),
    v_slug,
    'Africa/Lagos',
    180,
    true,
    coalesce(nullif(trim(p_public_base_url), ''), 'http://localhost:3000')
  )
  returning id into v_org_id;

  insert into public.admin_profiles (
    id,
    organization_id,
    full_name,
    email,
    phone,
    role,
    is_active
  ) values (
    v_uid,
    v_org_id,
    coalesce(nullif(trim(p_full_name), ''), split_part(p_email, '@', 1)),
    lower(trim(p_email)),
    coalesce(trim(p_phone), ''),
    'super_admin',
    true
  );

  return jsonb_build_object(
    'status', 'created',
    'organization_id', v_org_id,
    'admin_id', v_uid
  );
end;
$$;

grant execute on function public.bootstrap_first_admin(text, text, text, text, text, text) to authenticated;

-- 6.3 Inspect an Admin Invitation Token (for /invite/[token] page)
create or replace function public.get_invitation_by_token(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_inv record;
begin
  select
    i.id,
    i.email,
    i.role,
    i.expires_at,
    i.accepted_at,
    o.name as church_name,
    o.branch as branch_name
  into v_inv
  from public.admin_invitations i
  join public.organizations o on o.id = i.organization_id
  where i.token = trim(p_token)
  limit 1;

  if not found then
    return jsonb_build_object('valid', false, 'reason', 'not_found');
  end if;

  if v_inv.accepted_at is not null then
    return jsonb_build_object('valid', false, 'reason', 'already_accepted', 'email', v_inv.email);
  end if;

  if v_inv.expires_at <= now() then
    return jsonb_build_object('valid', false, 'reason', 'expired', 'email', v_inv.email);
  end if;

  return jsonb_build_object(
    'valid', true,
    'email', v_inv.email,
    'role', v_inv.role,
    'churchName', v_inv.church_name,
    'branchName', v_inv.branch_name,
    'expiresAt', v_inv.expires_at
  );
end;
$$;

grant execute on function public.get_invitation_by_token(text) to anon, authenticated;

-- 6.4 Public QR Session Lookup (Server-Validated Time & Status)
create or replace function public.get_public_session_by_token(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_session public.attendance_sessions%rowtype;
  v_org public.organizations%rowtype;
  v_local_now timestamp;
  v_local_date date;
  v_local_time time;
  v_state text;
  v_departments jsonb;
begin
  if p_token is null or trim(p_token) = '' then
    return jsonb_build_object('outcome', 'invalid-qr');
  end if;

  select *
  into v_session
  from public.attendance_sessions
  where lower(qr_token) = lower(trim(p_token))
  limit 1;

  if not found then
    return jsonb_build_object('outcome', 'invalid-qr');
  end if;

  select *
  into v_org
  from public.organizations
  where id = v_session.organization_id;

  -- Evaluate current date/time in the organization's timezone
  v_local_now := timezone(coalesce(v_org.timezone, 'Africa/Lagos'), now());
  v_local_date := v_local_now::date;
  v_local_time := v_local_now::time;

  if v_session.status in ('closed', 'expired') then
    v_state := 'closed';
  elsif v_session.status = 'upcoming' then
    v_state := 'not-open';
  elsif v_local_date < v_session.session_date then
    v_state := 'not-open';
  elsif v_local_date > v_session.session_date then
    v_state := 'closed';
  elsif v_local_time < v_session.start_time then
    v_state := 'not-open';
  elsif v_local_time > v_session.end_time then
    v_state := 'closed';
  else
    v_state := 'open';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', d.id,
        'name', d.name,
        'code', d.code,
        'leadName', d.lead_name,
        'description', d.description,
        'enabled', d.enabled,
        'memberCount', d.member_count
      )
      order by d.name asc
    ),
    '[]'::jsonb
  )
  into v_departments
  from public.departments d
  where d.organization_id = v_session.organization_id
    and d.enabled = true;

  return jsonb_build_object(
    'outcome', v_state,
    'churchName', v_org.name,
    'branchName', v_org.branch,
    'session', jsonb_build_object(
      'id', v_session.id,
      'title', v_session.title,
      'category', v_session.category,
      'date', v_session.session_date::text,
      'startTime', to_char(v_session.start_time, 'HH24:MI'),
      'endTime', to_char(v_session.end_time, 'HH24:MI'),
      'qrToken', v_session.qr_token,
      'status', v_session.status,
      'location', v_session.location,
      'notes', v_session.notes,
      'allowOtherDepartment', v_session.allow_other_department,
      'expectedCapacity', v_session.expected_capacity,
      'registrationCount', v_session.registration_count,
      'createdAt', v_session.created_at
    ),
    'departments', v_departments
  );
end;
$$;

grant execute on function public.get_public_session_by_token(text) to anon, authenticated;

-- 6.5 Public QR Attendance Submission (Server-Validated Window + Duplicate Protection)
create or replace function public.submit_public_attendance(
  p_token text,
  p_full_name text,
  p_department_id text,
  p_custom_department text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.attendance_sessions%rowtype;
  v_org public.organizations%rowtype;
  v_dept public.departments%rowtype;
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
begin
  if p_token is null or trim(p_token) = '' then
    return jsonb_build_object('outcome', 'invalid-qr');
  end if;

  select *
  into v_session
  from public.attendance_sessions
  where lower(qr_token) = lower(trim(p_token))
  limit 1;

  if not found then
    return jsonb_build_object('outcome', 'invalid-qr');
  end if;

  select *
  into v_org
  from public.organizations
  where id = v_session.organization_id;

  v_local_now := timezone(coalesce(v_org.timezone, 'Africa/Lagos'), now());
  v_local_date := v_local_now::date;
  v_local_time := v_local_now::time;

  if v_session.status in ('closed', 'expired') then
    return jsonb_build_object('outcome', 'closed');
  elsif v_session.status = 'upcoming' then
    return jsonb_build_object('outcome', 'not-open');
  elsif v_local_date < v_session.session_date or (v_local_date = v_session.session_date and v_local_time < v_session.start_time) then
    return jsonb_build_object('outcome', 'not-open');
  elsif v_local_date > v_session.session_date or (v_local_date = v_session.session_date and v_local_time > v_session.end_time) then
    return jsonb_build_object('outcome', 'closed');
  end if;

  v_clean_name := trim(regexp_replace(coalesce(p_full_name, ''), '\s+', ' ', 'g'));
  if char_length(v_clean_name) < 3 then
    raise exception 'Please enter your full name (at least 3 characters).';
  end if;

  v_normalized_name := lower(v_clean_name);

  -- Resolve department
  if lower(trim(coalesce(p_department_id, ''))) = 'congregation' then
    v_dept_uuid := null;
    v_dept_snapshot := 'General Congregation';
    v_custom_dept := null;
  elsif lower(trim(coalesce(p_department_id, ''))) = 'other' then
    if not v_session.allow_other_department then
      raise exception 'Custom department entry is not enabled for this session.';
    end if;
    v_custom_dept := trim(regexp_replace(coalesce(p_custom_department, ''), '\s+', ' ', 'g'));
    if char_length(v_custom_dept) < 2 then
      raise exception 'Please specify your department or unit name.';
    end if;
    v_dept_uuid := null;
    v_dept_snapshot := v_custom_dept;
  else
    begin
      v_dept_uuid := trim(p_department_id)::uuid;
    exception when others then
      raise exception 'Please select a valid department.';
    end;

    select *
    into v_dept
    from public.departments
    where id = v_dept_uuid
      and organization_id = v_session.organization_id
      and enabled = true;

    if not found then
      raise exception 'The selected department is not available for this session.';
    end if;

    v_dept_snapshot := v_dept.name;
    v_custom_dept := null;
  end if;

  -- Check duplicate before insert
  select *
  into v_existing
  from public.attendance_records
  where session_id = v_session.id
    and normalized_name = v_normalized_name
  limit 1;

  if found then
    return jsonb_build_object(
      'outcome', 'duplicate',
      'record', jsonb_build_object(
        'id', v_existing.id,
        'sessionId', v_existing.session_id,
        'sessionTitle', v_session.title,
        'sessionCategory', v_session.category,
        'sessionDate', v_session.session_date::text,
        'fullName', v_existing.full_name,
        'departmentId', coalesce(v_existing.department_id::text, 'other'),
        'departmentName', v_existing.department_name_snapshot,
        'customDepartment', v_existing.custom_department,
        'submittedAt', v_existing.submitted_at,
        'source', v_existing.source
      )
    );
  end if;

  begin
    insert into public.attendance_records (
      organization_id,
      session_id,
      full_name,
      department_id,
      department_name_snapshot,
      custom_department,
      source
    ) values (
      v_session.organization_id,
      v_session.id,
      v_clean_name,
      v_dept_uuid,
      v_dept_snapshot,
      v_custom_dept,
      'qr-web'
    )
    returning * into v_inserted;
  exception when unique_violation then
    select *
    into v_existing
    from public.attendance_records
    where session_id = v_session.id
      and normalized_name = v_normalized_name
    limit 1;

    return jsonb_build_object(
      'outcome', 'duplicate',
      'record', jsonb_build_object(
        'id', v_existing.id,
        'sessionId', v_existing.session_id,
        'sessionTitle', v_session.title,
        'sessionCategory', v_session.category,
        'sessionDate', v_session.session_date::text,
        'fullName', v_existing.full_name,
        'departmentId', coalesce(v_existing.department_id::text, 'other'),
        'departmentName', v_existing.department_name_snapshot,
        'customDepartment', v_existing.custom_department,
        'submittedAt', v_existing.submitted_at,
        'source', v_existing.source
      )
    );
  end;

  return jsonb_build_object(
    'outcome', 'success',
    'record', jsonb_build_object(
      'id', v_inserted.id,
      'sessionId', v_inserted.session_id,
      'sessionTitle', v_session.title,
      'sessionCategory', v_session.category,
      'sessionDate', v_session.session_date::text,
      'fullName', v_inserted.full_name,
      'departmentId', coalesce(v_inserted.department_id::text, 'other'),
      'departmentName', v_inserted.department_name_snapshot,
      'customDepartment', v_inserted.custom_department,
      'submittedAt', v_inserted.submitted_at,
      'source', v_inserted.source
    )
  );
end;
$$;

grant execute on function public.submit_public_attendance(text, text, text, text) to anon, authenticated;

-- 6.6 Atomic Super Admin Ownership Transfer (with Audit Log & Invariant Verification)
create or replace function public.transfer_super_admin_ownership(
  p_target_admin_id uuid,
  p_previous_admin_new_role text default 'admin',
  p_confirmation text default '',
  p_reason text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id uuid := auth.uid();
  v_caller public.admin_profiles%rowtype;
  v_target public.admin_profiles%rowtype;
  v_demoted_role text;
  v_clean_confirmation text;
  v_active_super_admins integer;
  v_log_row public.ownership_transfer_logs%rowtype;
begin
  if v_caller_id is null then
    raise exception 'Authentication is required to transfer Super Administrator ownership.';
  end if;

  if p_target_admin_id is null then
    raise exception 'Please select a target administrator account.';
  end if;

  if p_target_admin_id = v_caller_id then
    raise exception 'You cannot transfer Super Administrator ownership to your own account.';
  end if;

  -- Lock caller row first and verify active Super Admin status
  select *
  into v_caller
  from public.admin_profiles
  where id = v_caller_id
  for update;

  if not found or not v_caller.is_active or v_caller.role <> 'super_admin' then
    raise exception 'Only an active Super Administrator can initiate a Super Admin ownership transfer.';
  end if;

  -- Lock all admin profiles in this organization to serialize concurrent role operations
  perform 1
  from public.admin_profiles
  where organization_id = v_caller.organization_id
  for update;

  -- Fetch and validate target administrator within the same organization
  select *
  into v_target
  from public.admin_profiles
  where id = p_target_admin_id
    and organization_id = v_caller.organization_id
  for update;

  if not found then
    raise exception 'Target administrator was not found in your organization.';
  end if;

  if not v_target.is_active then
    raise exception 'Cannot transfer Super Administrator ownership to an inactive account.';
  end if;

  -- Validate the role assigned to the outgoing Super Admin
  v_demoted_role := coalesce(nullif(lower(trim(p_previous_admin_new_role)), ''), 'admin');
  if v_demoted_role not in ('admin', 'coordinator') then
    raise exception 'The previous Super Administrator must be assigned the role of "admin" or "coordinator".';
  end if;

  -- Require explicit confirmation matching either "TRANSFER" or the target administrator's email
  v_clean_confirmation := trim(coalesce(p_confirmation, ''));
  if upper(v_clean_confirmation) <> 'TRANSFER' and lower(v_clean_confirmation) <> lower(v_target.email) then
    raise exception 'Explicit confirmation is required. Type TRANSFER or the recipient email address to confirm.';
  end if;

  -- Perform atomic role transition with role-guard bypass enabled for this transaction scope
  perform set_config('app.bypass_role_guard', 'true', true);

  -- Step 1: Promote target administrator to super_admin first so the organization never has 0 Super Admins
  update public.admin_profiles
  set role = 'super_admin'
  where id = v_target.id
    and organization_id = v_caller.organization_id;

  -- Step 2: Demote outgoing Super Administrator to their selected role ('admin' by default)
  update public.admin_profiles
  set role = v_demoted_role
  where id = v_caller.id
    and organization_id = v_caller.organization_id;

  -- Step 3: Verify organization invariant (>= 1 active super_admin)
  select count(*)::integer
  into v_active_super_admins
  from public.admin_profiles
  where organization_id = v_caller.organization_id
    and role = 'super_admin'
    and is_active = true;

  if v_active_super_admins < 1 then
    raise exception 'Ownership transfer aborted: organization must retain at least one active Super Administrator.';
  end if;

  -- Step 4: Record immutable audit log entry
  insert into public.ownership_transfer_logs (
    organization_id,
    previous_super_admin_id,
    previous_super_admin_name,
    previous_super_admin_email,
    new_super_admin_id,
    new_super_admin_name,
    new_super_admin_email,
    previous_admin_new_role,
    reason
  ) values (
    v_caller.organization_id,
    v_caller.id,
    v_caller.full_name,
    v_caller.email,
    v_target.id,
    v_target.full_name,
    v_target.email,
    v_demoted_role,
    trim(coalesce(p_reason, ''))
  )
  returning * into v_log_row;

  perform set_config('app.bypass_role_guard', 'false', true);

  return jsonb_build_object(
    'status', 'transferred',
    'transferLog', jsonb_build_object(
      'id', v_log_row.id,
      'organizationId', v_log_row.organization_id,
      'previousSuperAdminId', v_log_row.previous_super_admin_id,
      'previousSuperAdminName', v_log_row.previous_super_admin_name,
      'previousSuperAdminEmail', v_log_row.previous_super_admin_email,
      'newSuperAdminId', v_log_row.new_super_admin_id,
      'newSuperAdminName', v_log_row.new_super_admin_name,
      'newSuperAdminEmail', v_log_row.new_super_admin_email,
      'previousAdminNewRole', v_log_row.previous_admin_new_role,
      'reason', v_log_row.reason,
      'transferredAt', v_log_row.transferred_at
    )
  );
end;
$$;

grant execute on function public.transfer_super_admin_ownership(uuid, text, text, text) to authenticated;

-- 6.7 Super Admin Team Member Governance (Role & Active Status Management for non-Super-Admins)
create or replace function public.manage_team_member(
  p_member_id uuid,
  p_role text default null,
  p_is_active boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id uuid := auth.uid();
  v_caller public.admin_profiles%rowtype;
  v_member public.admin_profiles%rowtype;
  v_next_role text;
  v_next_active boolean;
begin
  if v_caller_id is null then
    raise exception 'Authentication is required.';
  end if;

  select *
  into v_caller
  from public.admin_profiles
  where id = v_caller_id
  for update;

  if not found or not v_caller.is_active or v_caller.role <> 'super_admin' then
    raise exception 'Only an active Super Administrator can manage administrator roles and status.';
  end if;

  select *
  into v_member
  from public.admin_profiles
  where id = p_member_id
    and organization_id = v_caller.organization_id
  for update;

  if not found then
    raise exception 'Administrator account not found in your organization.';
  end if;

  if v_member.id = v_caller.id then
    raise exception 'Use the Super Admin Ownership Transfer workflow to change your own Super Admin role.';
  end if;

  if v_member.role = 'super_admin' then
    raise exception 'Use the Super Admin Ownership Transfer workflow to modify a Super Administrator account.';
  end if;

  v_next_role := coalesce(nullif(lower(trim(p_role)), ''), v_member.role);
  if v_next_role not in ('admin', 'coordinator') then
    raise exception 'Team member role must be "admin" or "coordinator". To promote to Super Admin, use Transfer Ownership.';
  end if;

  v_next_active := coalesce(p_is_active, v_member.is_active);

  perform set_config('app.bypass_role_guard', 'true', true);

  update public.admin_profiles
  set
    role = v_next_role,
    is_active = v_next_active
  where id = v_member.id
    and organization_id = v_caller.organization_id
  returning * into v_member;

  perform set_config('app.bypass_role_guard', 'false', true);

  return jsonb_build_object(
    'id', v_member.id,
    'role', v_member.role,
    'isActive', v_member.is_active
  );
end;
$$;

grant execute on function public.manage_team_member(uuid, text, boolean) to authenticated;
