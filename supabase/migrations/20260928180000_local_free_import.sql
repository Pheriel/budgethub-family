-- One atomic import per account. A failed insert rolls back both the ledger and every row.
create table if not exists public.local_free_imports (
  user_id uuid primary key references auth.users(id) on delete cascade,
  fingerprint text not null,
  counts jsonb not null,
  imported_at timestamptz not null default now()
);
alter table public.local_free_imports enable row level security;
revoke all on public.local_free_imports from anon, authenticated;
grant select on public.local_free_imports to authenticated;
create policy "Read own local import" on public.local_free_imports for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.import_local_free(p_data jsonb, p_fingerprint text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  row_data jsonb;
  old_import public.local_free_imports%rowtype;
  result jsonb;
  profile_plan text;
begin
  if uid is null then raise exception 'authentication_required'; end if;
  if p_fingerprint !~ '^[0-9a-f]{64}$' or pg_catalog.octet_length(p_data::text) > 500000 then
    raise exception 'invalid_import';
  end if;
  select * into old_import from public.local_free_imports where user_id = uid;
  if found then
    if old_import.fingerprint = p_fingerprint then return old_import.counts; end if;
    raise exception 'already_imported';
  end if;
  select plan into profile_plan from public.profiles where id = uid;
  if coalesce(profile_plan, '') <> 'free' then raise exception 'free_account_required'; end if;
  if jsonb_typeof(p_data) <> 'object'
    or jsonb_typeof(p_data->'months') <> 'array'
    or jsonb_array_length(p_data->'months') < 1
    or jsonb_array_length(p_data->'months') > 60
    or jsonb_typeof(p_data->'debts') <> 'array'
    or jsonb_typeof(p_data->'goals') <> 'array'
    or jsonb_typeof(p_data->'budget') <> 'array'
    or jsonb_typeof(p_data->'transactions') <> 'array'
    or jsonb_array_length(p_data->'debts') > 10
    or jsonb_array_length(p_data->'goals') > 1000
    or jsonb_array_length(p_data->'budget') > 1000
    or jsonb_array_length(p_data->'transactions') > 1000 then
    raise exception 'invalid_import';
  end if;
  -- No merge into a populated cloud workspace: avoids duplicate or overwritten records.
  if exists(select 1 from public.debts where user_id = uid)
    or exists(select 1 from public.budget_categories where user_id = uid)
    or exists(select 1 from public.transactions where user_id = uid)
    or exists(select 1 from public.goals where user_id = uid)
    or exists(select 1 from public.profiles where id = uid and coalesce(monthly_income, 0) <> 0)
  then raise exception 'cloud_data_present'; end if;

  result := pg_catalog.jsonb_build_object(
    'months', jsonb_array_length(p_data->'months'),
    'debts', jsonb_array_length(p_data->'debts'),
    'goals', jsonb_array_length(p_data->'goals'),
    'budget', jsonb_array_length(p_data->'budget'),
    'transactions', jsonb_array_length(p_data->'transactions')
  );
  -- The unique ledger also serializes concurrent attempts for this account.
  insert into public.local_free_imports(user_id, fingerprint, counts) values (uid, p_fingerprint, result);

  for row_data in select value from pg_catalog.jsonb_array_elements(p_data->'debts') loop
    insert into public.debts(user_id, name, balance, rate, min_payment, payment_day)
    values (uid, row_data->>'name', (row_data->>'balance')::numeric, (row_data->>'rate')::numeric,
      (row_data->>'min_payment')::numeric, (row_data->>'payment_day')::integer);
  end loop;
  for row_data in select value from pg_catalog.jsonb_array_elements(p_data->'goals') loop
    insert into public.goals(user_id, name, target, saved, monthly_contribution, contribution_frequency, target_date, status)
    values (uid, row_data->>'name', (row_data->>'target')::numeric, (row_data->>'saved')::numeric,
      (row_data->>'monthly_contribution')::numeric, row_data->>'contribution_frequency',
      (row_data->>'target_date')::date, row_data->>'status');
  end loop;
  for row_data in select value from pg_catalog.jsonb_array_elements(p_data->'budget') loop
    insert into public.budget_categories(user_id, name, category, planned, spent, due_day, is_recurring, frequency, notes, month_key)
    values (uid, row_data->>'name', row_data->>'category', (row_data->>'planned')::numeric,
      (row_data->>'spent')::numeric, (row_data->>'due_day')::integer, (row_data->>'is_recurring')::boolean,
      row_data->>'frequency', row_data->>'notes', row_data->>'month_key');
  end loop;
  for row_data in select value from pg_catalog.jsonb_array_elements(p_data->'transactions') loop
    insert into public.transactions(user_id, date, name, category, amount)
    values (uid, (row_data->>'date')::date, row_data->>'name', row_data->>'category', (row_data->>'amount')::numeric);
  end loop;
  if p_data->'income' is not null and p_data->'income' <> 'null'::jsonb then
    update public.profiles set income_amount = (p_data->'income'->>'amount')::numeric,
      monthly_income = (p_data->'income'->>'monthly')::numeric,
      income_frequency = p_data->'income'->>'frequency'
    where id = uid;
  end if;
  return result;
end;
$$;
revoke all on function public.import_local_free(jsonb, text) from public, anon;
grant execute on function public.import_local_free(jsonb, text) to authenticated;

-- A ban stops new sign-ins, but previously issued JWTs can remain valid.
-- Restrictive policies close that window for profile and core financial data.
create or replace function private.account_active(uid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists(select 1 from public.profiles where id = uid and is_suspended is not true);
$$;
revoke all on function private.account_active(uuid) from public, anon;
grant execute on function private.account_active(uuid) to authenticated, service_role;
do $$
declare tbl text;
begin
  foreach tbl in array array['profiles', 'debts', 'budget_categories', 'transactions', 'goals', 'family_members', 'item_contributions', 'goal_contributions', 'support_tickets', 'support_ticket_messages'] loop
    execute format('create policy "Active account only" on public.%I as restrictive for all to authenticated using (private.account_active((select auth.uid()))) with check (private.account_active((select auth.uid())))', tbl);
  end loop;
end;
$$;
