-- Dépenses récurrentes "Marquer payé" + suivi détaillé des objectifs.
-- Migration additive et sécuritaire: colonnes nullables + nouvelle table. Aucune donnée supprimée.

-- 1) Lien transaction -> dépense récurrente payée (Marquer payé, sans doublon)
alter table public.transactions
  add column if not exists source_expense_id uuid references public.budget_categories(id) on delete set null;

create index if not exists transactions_source_expense_idx
  on public.transactions(source_expense_id);

-- 2) Suivi des objectifs: fréquence de contribution, date cible, statut
alter table public.goals
  add column if not exists contribution_frequency text not null default 'monthly',
  add column if not exists target_date date,
  add column if not exists status text not null default 'active';

alter table public.goals
  drop constraint if exists goals_status_check;
alter table public.goals
  add constraint goals_status_check check (status in ('active', 'reached', 'paused'));

-- 3) Historique des contributions ponctuelles aux objectifs
create table if not exists public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric not null default 0,
  note text not null default '',
  contributed_on date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists goal_contributions_goal_idx
  on public.goal_contributions(goal_id);

alter table public.goal_contributions enable row level security;

-- RLS calquée sur public.goals: lecture perso ou famille partagée, écriture par rôles éditeurs.
drop policy if exists "own or shared select" on public.goal_contributions;
create policy "own or shared select" on public.goal_contributions
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.goals g
      where g.id = goal_id
        and g.is_shared
        and family_owner_of(g.user_id) = family_owner_of(auth.uid())
    )
  );

drop policy if exists "editors insert" on public.goal_contributions;
create policy "editors insert" on public.goal_contributions
  for insert with check (
    auth.uid() = user_id
    and family_role_of(auth.uid()) = any (array['Owner', 'Admin', 'Editor'])
  );

drop policy if exists "editors delete" on public.goal_contributions;
create policy "editors delete" on public.goal_contributions
  for delete using (
    user_id = auth.uid()
    and family_role_of(auth.uid()) = any (array['Owner', 'Admin', 'Editor'])
  );
