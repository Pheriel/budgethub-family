-- Clarifie budget_categories comme dépenses mensuelles prévues.
-- Migration sécuritaire: aucune donnée existante n'est supprimée.

alter table public.budget_categories
  add column if not exists name text,
  add column if not exists due_day integer,
  add column if not exists is_recurring boolean not null default true,
  add column if not exists notes text not null default '',
  add column if not exists month_key text;

update public.budget_categories
set
  name = coalesce(nullif(name, ''), category),
  month_key = coalesce(month_key, to_char(now(), 'YYYY-MM'))
where name is null
   or name = ''
   or month_key is null;

alter table public.budget_categories
  drop constraint if exists budget_categories_due_day_check;

alter table public.budget_categories
  add constraint budget_categories_due_day_check
  check (due_day is null or (due_day between 1 and 31));

create index if not exists budget_categories_user_month_idx
  on public.budget_categories(user_id, month_key);
