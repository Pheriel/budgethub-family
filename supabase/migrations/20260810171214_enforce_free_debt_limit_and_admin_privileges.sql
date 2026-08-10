-- Pre-launch hardening:
-- 1) enforce the Free plan debt limit in Postgres, not only in the browser;
-- 2) move SECURITY DEFINER authorization helpers out of the exposed schema;
-- 3) make the admin audit log privileges explicit and service-only.
-- This migration is non-destructive: it does not delete or rewrite user data.

create schema if not exists private;

-- These helpers are used by RLS policies. Keeping them in an unexposed schema
-- prevents /rest/v1/rpc calls while preserving their RLS-recursion bypass.
create or replace function private.family_owner_of(uid uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(p.family_owner_id, p.id)
  from public.profiles p
  where p.id = uid;
$$;

create or replace function private.family_role_of(uid uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1
      from public.profiles p
      where p.id = uid and p.is_suspended is true
    ) then 'Suspended'
    when private.family_owner_of(uid) = uid then 'Owner'
    else coalesce(
      (
        select case when fm.role = 'Parent' then 'Editor' else fm.role end
        from public.family_members fm
        where fm.invited_user_id = uid
        order by fm.created_at desc
        limit 1
      ),
      'Viewer'
    )
  end;
$$;

revoke all on function private.family_owner_of(uuid) from public, anon;
revoke all on function private.family_role_of(uuid) from public, anon;
grant usage on schema private to authenticated, service_role;
grant execute on function private.family_owner_of(uuid) to authenticated, service_role;
grant execute on function private.family_role_of(uuid) to authenticated, service_role;

-- Preserve every existing RLS expression, changing only the helper schema.
-- ALTER POLICY avoids replacing unrelated policy rules or widening access.
do $$
declare
  pol record;
  statement text;
  next_using text;
  next_check text;
begin
  for pol in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (
        coalesce(qual, '') like '%family_owner_of(%'
        or coalesce(qual, '') like '%family_role_of(%'
        or coalesce(with_check, '') like '%family_owner_of(%'
        or coalesce(with_check, '') like '%family_role_of(%'
      )
  loop
    next_using := replace(
      replace(pol.qual, 'family_owner_of(', 'private.family_owner_of('),
      'family_role_of(', 'private.family_role_of('
    );
    next_check := replace(
      replace(pol.with_check, 'family_owner_of(', 'private.family_owner_of('),
      'family_role_of(', 'private.family_role_of('
    );
    statement := format('alter policy %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    if next_using is not null then
      statement := statement || format(' using (%s)', next_using);
    end if;
    if next_check is not null then
      statement := statement || format(' with check (%s)', next_check);
    end if;
    execute statement;
  end loop;
end;
$$;

-- Public copies are no longer used by RLS and must not remain callable as RPCs.
revoke all on function public.family_owner_of(uuid) from public, anon, authenticated;
revoke all on function public.family_role_of(uuid) from public, anon, authenticated;

-- Trigger functions run through their triggers and need no browser EXECUTE.
revoke all on function public.handle_new_user() from public, anon, authenticated;

create or replace function public.set_support_ticket_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_support_ticket_updated_at() from public, anon, authenticated;

create or replace function private.enforce_free_debt_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  current_plan text;
  current_debt_count integer;
begin
  -- Trusted server-side maintenance using the service role has no auth.uid().
  -- Browser writes are still constrained by the debts RLS policies.
  if caller_id is null or new.user_id is distinct from caller_id then
    return new;
  end if;

  -- Lock the user's profile row so concurrent inserts cannot both claim the
  -- final available slot. A missing profile is treated conservatively as Free.
  select coalesce(p.plan, 'free')
    into current_plan
  from public.profiles p
  where p.id = new.user_id
  for update;

  if not found then
    current_plan := 'free';
  end if;

  if current_plan = 'free' then
    select count(*)::integer
      into current_debt_count
    from public.debts d
    where d.user_id = new.user_id;

    if current_debt_count >= 10 then
      raise exception using
        errcode = 'P0001',
        message = 'free_debt_limit_reached',
        detail = 'The Free plan allows a maximum of 10 debts.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_free_debt_limit() from public, anon, authenticated;

drop trigger if exists enforce_free_debt_limit on public.debts;
create trigger enforce_free_debt_limit
before insert on public.debts
for each row execute function private.enforce_free_debt_limit();

create index if not exists debts_user_id_idx on public.debts(user_id);

-- The browser never needs the administration audit log. Express accesses it
-- only after validating a Supabase access token and the SUPER_ADMIN_EMAILS
-- allowlist, using the service role exclusively on the server.
revoke all on table public.admin_audit_logs from anon, authenticated, service_role;
grant select, insert on table public.admin_audit_logs to service_role;
