-- Automatic month-end reconciling for accounts with a bank feed (Wesley Owen, Nov 2, 2026; lib/bank-feeds.ts
-- autoReconcile). The nightly job reconciles last month by itself when the bank's month-end balance equals the
-- matched book entries and every bank transaction is matched; otherwise it leaves the month for a person.
alter table public.reconciliation add column automatic boolean not null default false;
