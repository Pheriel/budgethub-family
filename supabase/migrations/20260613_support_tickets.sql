-- Support ticket system for BudgetHub Family.
-- Apply with Supabase SQL Editor or Supabase CLI when available.

create sequence if not exists public.support_ticket_number_seq start 1;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique default (
    'BHF-' || lpad(nextval('public.support_ticket_number_seq')::text, 6, '0')
  ),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text not null,
  category text not null check (category in (
    'payment_issue',
    'login_issue',
    'subscription_issue',
    'budget_bug',
    'debt_bug',
    'general_question',
    'refund_request',
    'other'
  )),
  subject text not null check (char_length(subject) between 1 and 160),
  message text not null check (char_length(message) between 1 and 5000),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  author_email text not null,
  author_role text not null check (author_role in ('customer', 'admin')),
  message text not null check (char_length(message) between 1 and 5000),
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists support_tickets_user_created_idx
  on public.support_tickets (user_id, created_at desc);
create index if not exists support_tickets_status_created_idx
  on public.support_tickets (status, created_at desc);
create index if not exists support_tickets_category_idx
  on public.support_tickets (category);
create index if not exists support_tickets_priority_idx
  on public.support_tickets (priority);
create index if not exists support_ticket_messages_ticket_created_idx
  on public.support_ticket_messages (ticket_id, created_at);

alter table public.support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;

drop policy if exists "users read own support tickets" on public.support_tickets;
drop policy if exists "users create own support tickets" on public.support_tickets;
drop policy if exists "users read own public support messages" on public.support_ticket_messages;
drop policy if exists "users create own support messages" on public.support_ticket_messages;

create policy "users read own support tickets"
on public.support_tickets for select
to authenticated
using (user_id = auth.uid());

create policy "users create own support tickets"
on public.support_tickets for insert
to authenticated
with check (user_id = auth.uid());

create policy "users read own public support messages"
on public.support_ticket_messages for select
to authenticated
using (
  is_internal is false
  and exists (
    select 1
    from public.support_tickets st
    where st.id = support_ticket_messages.ticket_id
      and st.user_id = auth.uid()
  )
);

create policy "users create own support messages"
on public.support_ticket_messages for insert
to authenticated
with check (
  author_user_id = auth.uid()
  and author_role = 'customer'
  and is_internal is false
  and exists (
    select 1
    from public.support_tickets st
    where st.id = support_ticket_messages.ticket_id
      and st.user_id = auth.uid()
  )
);

create or replace function public.set_support_ticket_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_support_ticket_updated_at on public.support_tickets;
create trigger set_support_ticket_updated_at
before update on public.support_tickets
for each row execute function public.set_support_ticket_updated_at();
