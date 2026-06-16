-- Lien transaction -> dette pour "Marquer paiement effectué".
-- Migration additive et sécuritaire: colonne nullable. Aucune donnée supprimée.

alter table public.transactions
  add column if not exists source_debt_id uuid references public.debts(id) on delete set null;

create index if not exists transactions_source_debt_idx
  on public.transactions(source_debt_id);
