-- Partage familial par item: chaque dette, dépense, transaction et objectif
-- peut être PERSONNEL (par défaut, visible du seul propriétaire) ou COMMUN
-- (partagé avec la famille, avec un mode de répartition).
-- Migration idempotente et NON destructive (aucune donnée supprimée).

-- 1) Colonnes de partage sur les tables existantes + table de contributions.
do $$
declare
  tbl text;
begin
  foreach tbl in array array['debts', 'budget_categories', 'transactions', 'goals'] loop
    execute format($f$
      alter table public.%1$I
        add column if not exists is_shared boolean not null default false,
        add column if not exists split_mode text not null default 'equal',
        add column if not exists split_config jsonb not null default '{}'::jsonb
    $f$, tbl);

    -- split_mode: parts égales / pourcentage par membre / montant fixe par membre
    execute format('alter table public.%1$I drop constraint if exists %1$I_split_mode_check', tbl);
    execute format($f$
      alter table public.%1$I
        add constraint %1$I_split_mode_check
        check (split_mode in ('equal', 'percent', 'fixed'))
    $f$, tbl);

    -- PRÉSERVATION: les lignes déjà existantes étaient visibles de toute la
    -- famille avant cette migration. On les marque "communes" pour ne rien
    -- masquer (aucune perte ni disparition de données). Les NOUVELLES lignes
    -- sont personnelles par défaut.
    execute format('update public.%1$I set is_shared = true where is_shared = false', tbl);

    -- SELECT: ses propres lignes OU une ligne commune de sa famille.
    execute format('drop policy if exists "family rows select" on public.%1$I', tbl);
    execute format('drop policy if exists "own or shared select" on public.%1$I', tbl);
    execute format($f$
      create policy "own or shared select" on public.%1$I for select
      using (
        user_id = auth.uid()
        or (is_shared and family_owner_of(user_id) = family_owner_of(auth.uid()))
      )
    $f$, tbl);

    -- UPDATE: sa propre ligne, ou une ligne commune de sa famille; rôle éditeur+.
    execute format('drop policy if exists "editors update" on public.%1$I', tbl);
    execute format($f$
      create policy "editors update" on public.%1$I for update
      using (
        (user_id = auth.uid()
          or (is_shared and family_owner_of(user_id) = family_owner_of(auth.uid())))
        and family_role_of(auth.uid()) in ('Owner', 'Admin', 'Editor')
      )
    $f$, tbl);

    -- DELETE: même règle que UPDATE.
    execute format('drop policy if exists "editors delete" on public.%1$I', tbl);
    execute format($f$
      create policy "editors delete" on public.%1$I for delete
      using (
        (user_id = auth.uid()
          or (is_shared and family_owner_of(user_id) = family_owner_of(auth.uid())))
        and family_role_of(auth.uid()) in ('Owner', 'Admin', 'Editor')
      )
    $f$, tbl);

    -- INSERT inchangé: on insère ses propres lignes (rôle éditeur+).
    execute format('drop policy if exists "editors insert" on public.%1$I', tbl);
    execute format($f$
      create policy "editors insert" on public.%1$I for insert
      with check (
        auth.uid() = user_id
        and family_role_of(auth.uid()) in ('Owner', 'Admin', 'Editor')
      )
    $f$, tbl);
  end loop;
end $$;

-- 2) Contributions payées par membre sur un item commun.
create table if not exists public.item_contributions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,                 -- propriétaire de la famille (family_owner_of)
  item_table text not null check (item_table in ('debts', 'budget_categories', 'transactions', 'goals')),
  item_id uuid not null,
  member_user_id uuid not null,           -- membre qui a payé
  amount numeric not null default 0 check (amount >= 0),
  note text not null default '',
  paid_on date not null default current_date,
  created_at timestamp with time zone not null default now()
);

create index if not exists item_contributions_item_idx on public.item_contributions(item_table, item_id);
create index if not exists item_contributions_owner_idx on public.item_contributions(owner_id);

alter table public.item_contributions enable row level security;

drop policy if exists "family contributions select" on public.item_contributions;
create policy "family contributions select" on public.item_contributions for select
using (owner_id = family_owner_of(auth.uid()));

drop policy if exists "family contributions insert" on public.item_contributions;
create policy "family contributions insert" on public.item_contributions for insert
with check (
  owner_id = family_owner_of(auth.uid())
  and family_role_of(auth.uid()) in ('Owner', 'Admin', 'Editor')
);

drop policy if exists "family contributions update" on public.item_contributions;
create policy "family contributions update" on public.item_contributions for update
using (
  owner_id = family_owner_of(auth.uid())
  and family_role_of(auth.uid()) in ('Owner', 'Admin', 'Editor')
);

drop policy if exists "family contributions delete" on public.item_contributions;
create policy "family contributions delete" on public.item_contributions for delete
using (
  owner_id = family_owner_of(auth.uid())
  and family_role_of(auth.uid()) in ('Owner', 'Admin', 'Editor')
);
