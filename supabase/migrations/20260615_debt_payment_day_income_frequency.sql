alter table public.debts
  add column if not exists payment_day integer not null default 1;

alter table public.debts
  drop constraint if exists debts_payment_day_check;

alter table public.debts
  add constraint debts_payment_day_check
  check (payment_day between 1 and 31);

alter table public.profiles
  add column if not exists income_amount numeric,
  add column if not exists income_frequency text not null default 'monthly';

update public.profiles
set
  income_amount = coalesce(income_amount, monthly_income),
  income_frequency = coalesce(income_frequency, 'monthly');

alter table public.profiles
  drop constraint if exists profiles_income_frequency_check;

alter table public.profiles
  add constraint profiles_income_frequency_check
  check (income_frequency in ('weekly', 'biweekly', 'every15', 'twiceMonthly', 'monthly', 'annual'));
