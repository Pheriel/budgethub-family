-- Rôles famille: Owner (propriétaire), Admin, Editor, Viewer (lecture seule).
-- À appliquer dans Supabase (SQL Editor ou supabase db push).
-- L'ancien rôle "Parent" devient "Editor".
update public.family_members set role = 'Editor' where role = 'Parent';

create or replace function public.family_role_of(uid uuid)
returns text
language sql
stable security definer
set search_path to 'public'
as $$
  select case
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

-- Tables de données: écriture réservée à Owner/Admin/Editor (Viewer = lecture seule)
do $$
declare
  tbl text;
begin
  foreach tbl in array array['debts', 'budget_categories', 'transactions', 'goals'] loop
    execute format('drop policy if exists "own rows insert" on public.%I', tbl);
    execute format('drop policy if exists "family rows update" on public.%I', tbl);
    execute format('drop policy if exists "family rows delete" on public.%I', tbl);

    execute format($p$
      create policy "editors insert" on public.%I for insert
      with check (
        auth.uid() = user_id
        and family_role_of(auth.uid()) in ('Owner', 'Admin', 'Editor')
      )
    $p$, tbl);

    execute format($p$
      create policy "editors update" on public.%I for update
      using (
        family_owner_of(user_id) = family_owner_of(auth.uid())
        and family_role_of(auth.uid()) in ('Owner', 'Admin', 'Editor')
      )
    $p$, tbl);

    execute format($p$
      create policy "editors delete" on public.%I for delete
      using (
        family_owner_of(user_id) = family_owner_of(auth.uid())
        and family_role_of(auth.uid()) in ('Owner', 'Admin', 'Editor')
      )
    $p$, tbl);
  end loop;
end $$;

-- Gestion des membres: réservée à Owner/Admin (les règles fines passent par le backend)
drop policy if exists "own rows insert" on public.family_members;
drop policy if exists "family rows update" on public.family_members;
drop policy if exists "family rows delete" on public.family_members;

create policy "managers insert" on public.family_members for insert
with check (
  auth.uid() = user_id
  and family_role_of(auth.uid()) in ('Owner', 'Admin')
);

create policy "managers update" on public.family_members for update
using (
  family_owner_of(user_id) = family_owner_of(auth.uid())
  and family_role_of(auth.uid()) in ('Owner', 'Admin')
);

create policy "managers delete" on public.family_members for delete
using (
  family_owner_of(user_id) = family_owner_of(auth.uid())
  and family_role_of(auth.uid()) in ('Owner', 'Admin')
);
