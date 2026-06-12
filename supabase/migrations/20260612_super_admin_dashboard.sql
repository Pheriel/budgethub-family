-- Super Admin Dashboard support.
-- Apply in Supabase SQL Editor or with the Supabase CLI before using /admin.

alter table public.profiles
  add column if not exists is_suspended boolean not null default false,
  add column if not exists suspended_at timestamptz;

create or replace function public.family_role_of(uid uuid)
returns text
language sql
stable security definer
set search_path to 'public'
as $$
  select case
    when exists (
      select 1 from public.profiles p
      where p.id = uid and p.is_suspended is true
    ) then 'Suspended'
    when family_owner_of(uid) = uid then 'Owner'
    else coalesce(
      (select case when fm.role = 'Parent' then 'Editor' else fm.role end
       from public.family_members fm
       where fm.invited_user_id = uid
       order by fm.created_at desc
       limit 1),
      'Viewer'
    )
  end;
$$;

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  actor_email text not null,
  target_user_id uuid not null,
  action text not null,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_target_created_idx
  on public.admin_audit_logs (target_user_id, created_at desc);

alter table public.admin_audit_logs enable row level security;

-- No browser/client access. The Express backend writes and reads this table
-- with SUPABASE_SERVICE_ROLE_KEY after verifying SUPER_ADMIN_EMAILS.
drop policy if exists "admin audit logs are service role only" on public.admin_audit_logs;
