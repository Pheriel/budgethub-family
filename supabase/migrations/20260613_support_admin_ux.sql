-- Support admin UX additions: unread tracking and waiting-customer status.

alter table public.support_tickets
  add column if not exists admin_read_at timestamptz,
  add column if not exists customer_read_at timestamptz;

alter table public.support_tickets
  drop constraint if exists support_tickets_status_check;

alter table public.support_tickets
  add constraint support_tickets_status_check
  check (status in ('open', 'in_progress', 'waiting_customer', 'closed'));

create index if not exists support_tickets_admin_unread_idx
  on public.support_tickets (admin_read_at, status, created_at desc);

create index if not exists support_tickets_customer_unread_idx
  on public.support_tickets (user_id, customer_read_at, status, created_at desc);
