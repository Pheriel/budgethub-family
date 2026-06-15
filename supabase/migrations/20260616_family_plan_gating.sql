-- Réserve les fonctions famille aux plans Family et Family Plus.
-- Bloque côté RLS le partage familial et les contributions pour Free/Solo.

create or replace function public.family_plan_enabled(uid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = uid
      and p.plan in ('family', 'familyPlus')
  );
$$;

do $$
declare
  tbl text;
begin
  foreach tbl in array array['debts', 'budget_categories', 'transactions', 'goals'] loop
    execute format('drop policy if exists "own or shared select" on public.%1$I', tbl);
    execute format('drop policy if exists "editors update" on public.%1$I', tbl);
    execute format('drop policy if exists "editors delete" on public.%1$I', tbl);
    execute format('drop policy if exists "editors insert" on public.%1$I', tbl);

    execute format($f$
      create policy "own or shared select" on public.%1$I for select
      using (
        user_id = auth.uid()
        or (
          is_shared
          and family_plan_enabled(auth.uid())
          and family_owner_of(user_id) = family_owner_of(auth.uid())
        )
      )
    $f$, tbl);

    execute format($f$
      create policy "editors update" on public.%1$I for update
      using (
        (
          user_id = auth.uid()
          or (
            is_shared
            and family_plan_enabled(auth.uid())
            and family_owner_of(user_id) = family_owner_of(auth.uid())
          )
        )
        and family_role_of(auth.uid()) in ('Owner', 'Admin', 'Editor')
      )
      with check (
        family_role_of(auth.uid()) in ('Owner', 'Admin', 'Editor')
        and (not is_shared or family_plan_enabled(auth.uid()))
      )
    $f$, tbl);

    execute format($f$
      create policy "editors delete" on public.%1$I for delete
      using (
        (
          user_id = auth.uid()
          or (
            is_shared
            and family_plan_enabled(auth.uid())
            and family_owner_of(user_id) = family_owner_of(auth.uid())
          )
        )
        and family_role_of(auth.uid()) in ('Owner', 'Admin', 'Editor')
      )
    $f$, tbl);

    execute format($f$
      create policy "editors insert" on public.%1$I for insert
      with check (
        auth.uid() = user_id
        and family_role_of(auth.uid()) in ('Owner', 'Admin', 'Editor')
        and (not is_shared or family_plan_enabled(auth.uid()))
      )
    $f$, tbl);
  end loop;
end $$;

drop policy if exists "family contributions select" on public.item_contributions;
create policy "family contributions select" on public.item_contributions for select
using (
  family_plan_enabled(auth.uid())
  and owner_id = family_owner_of(auth.uid())
);

drop policy if exists "family contributions insert" on public.item_contributions;
create policy "family contributions insert" on public.item_contributions for insert
with check (
  family_plan_enabled(auth.uid())
  and owner_id = family_owner_of(auth.uid())
  and family_role_of(auth.uid()) in ('Owner', 'Admin', 'Editor')
);

drop policy if exists "family contributions update" on public.item_contributions;
create policy "family contributions update" on public.item_contributions for update
using (
  family_plan_enabled(auth.uid())
  and owner_id = family_owner_of(auth.uid())
  and family_role_of(auth.uid()) in ('Owner', 'Admin', 'Editor')
)
with check (
  family_plan_enabled(auth.uid())
  and owner_id = family_owner_of(auth.uid())
  and family_role_of(auth.uid()) in ('Owner', 'Admin', 'Editor')
);

drop policy if exists "family contributions delete" on public.item_contributions;
create policy "family contributions delete" on public.item_contributions for delete
using (
  family_plan_enabled(auth.uid())
  and owner_id = family_owner_of(auth.uid())
  and family_role_of(auth.uid()) in ('Owner', 'Admin', 'Editor')
);
