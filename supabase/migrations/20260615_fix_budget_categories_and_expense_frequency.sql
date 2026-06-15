-- Corrige le 400 Bad Request sur GET /rest/v1/budget_categories.
-- Cause: l'app sélectionne name, due_day, is_recurring, notes, month_key
-- (+ frequency) alors que ces colonnes n'avaient jamais été appliquées en prod.
-- Migration 100% idempotente et non destructive: aucune donnée existante n'est perdue.

alter table public.budget_categories
  add column if not exists name text,
  add column if not exists due_day integer,
  add column if not exists is_recurring boolean not null default true,
  add column if not exists notes text not null default '',
  add column if not exists month_key text,
  add column if not exists frequency text not null default 'monthly';

-- Renseigne les valeurs manquantes pour les lignes déjà présentes.
update public.budget_categories
set
  name = coalesce(nullif(name, ''), category),
  month_key = coalesce(month_key, to_char(now(), 'YYYY-MM'))
where name is null
   or name = ''
   or month_key is null;

-- Jour du mois valide (1-31) ou nul.
alter table public.budget_categories
  drop constraint if exists budget_categories_due_day_check;
alter table public.budget_categories
  add constraint budget_categories_due_day_check
  check (due_day is null or (due_day between 1 and 31));

-- Fréquence de récurrence alignée sur les fréquences de revenus.
alter table public.budget_categories
  drop constraint if exists budget_categories_frequency_check;
alter table public.budget_categories
  add constraint budget_categories_frequency_check
  check (frequency in ('weekly', 'biweekly', 'every15', 'twiceMonthly', 'monthly', 'annual'));

create index if not exists budget_categories_user_month_idx
  on public.budget_categories(user_id, month_key);
