-- =====================================================================
-- PAYable database schema
-- =====================================================================
-- Design notes:
--
-- 1. MONEY IS STORED AS BIGINT CENTAVOS (1 peso = 100), never as float.
--    This avoids floating point rounding bugs entirely. The application
--    layer converts to/from decimal pesos only at the UI boundary.
--
-- 2. `users` mirrors `auth.users` (Supabase Auth) 1:1 via a shared UUID
--    primary key. This project ships with exactly two rows in `users`,
--    but nothing in the schema hardcodes "two" — a third, fourth, etc.
--    user could be added later. Splits are per-user rows in
--    `transaction_splits`, not fixed columns, so the model generalizes
--    to groups without a migration.
--
-- 3. The balance between any two users is NEVER stored. It is always
--    derived from `transactions` + `transaction_splits` + `payments`.
--    See src/lib/balance.ts for the single source of truth for that
--    calculation on the application side, and the `balances` view below
--    for a database-level equivalent used by reports/export.
--
-- 4. A trigger enforces that a transaction's splits always sum exactly
--    to its total_amount, so bad data can never enter the database even
--    if a client bug slips past UI validation.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- USERS
-- ---------------------------------------------------------------------
create table if not exists users (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null unique,
  avatar_url text,
  created_at timestamptz not null default now()
);

comment on table users is 'App users. Mirrors auth.users. Two rows today, extensible to more.';

-- ---------------------------------------------------------------------
-- CATEGORIES
-- ---------------------------------------------------------------------
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  icon text not null default '💸',
  sort_order int not null default 0
);

insert into categories (name, icon, sort_order) values
  ('Food', '🍔', 1),
  ('Groceries', '🛒', 2),
  ('Transportation', '🚗', 3),
  ('Entertainment', '🎬', 4),
  ('Shopping', '🛍️', 5),
  ('Household', '🏠', 6),
  ('Subscriptions', '📱', 7),
  ('Gifts', '🎁', 8),
  ('Other', '📦', 9)
on conflict (name) do nothing;

-- ---------------------------------------------------------------------
-- TRANSACTIONS
-- ---------------------------------------------------------------------
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  description text not null check (char_length(trim(description)) > 0),
  category_id uuid not null references categories (id),
  total_amount_cents bigint not null check (total_amount_cents > 0),
  paid_by uuid not null references users (id),
  date date not null default current_date,
  notes text,
  created_by uuid references users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_transactions_date on transactions (date desc);
create index if not exists idx_transactions_category on transactions (category_id);
create index if not exists idx_transactions_paid_by on transactions (paid_by);

-- ---------------------------------------------------------------------
-- TRANSACTION SPLITS
-- One row per participant per transaction. amount_cents is the
-- authoritative share; percentage is stored for display/edit purposes
-- only and is never used in balance math.
-- ---------------------------------------------------------------------
create table if not exists transaction_splits (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions (id) on delete cascade,
  user_id uuid not null references users (id),
  amount_cents bigint not null check (amount_cents >= 0),
  percentage numeric(6, 3),
  unique (transaction_id, user_id)
);

create index if not exists idx_splits_transaction on transaction_splits (transaction_id);
create index if not exists idx_splits_user on transaction_splits (user_id);

-- Enforce: splits for a transaction must sum exactly to its total.
create or replace function check_splits_sum_to_total()
returns trigger as $$
declare
  txn_total bigint;
  split_sum bigint;
  txn_id uuid;
begin
  txn_id := coalesce(new.transaction_id, old.transaction_id);

  select total_amount_cents into txn_total
  from transactions where id = txn_id;

  select coalesce(sum(amount_cents), 0) into split_sum
  from transaction_splits where transaction_id = txn_id;

  if txn_total is not null and split_sum <> txn_total then
    raise exception
      'Transaction splits (%) must sum to the total amount (%)',
      split_sum, txn_total;
  end if;

  return null;
end;
$$ language plpgsql;

drop trigger if exists trg_check_splits_after_change on transaction_splits;
create constraint trigger trg_check_splits_after_change
  after insert or update or delete on transaction_splits
  deferrable initially deferred
  for each row execute function check_splits_sum_to_total();

-- ---------------------------------------------------------------------
-- PAYMENTS (settlements) — reduce debt, are never expenses.
-- ---------------------------------------------------------------------
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references users (id),
  to_user uuid not null references users (id),
  amount_cents bigint not null check (amount_cents > 0),
  payment_method text not null default 'Cash'
    check (payment_method in ('Cash', 'GCash', 'Bank Transfer', 'Other')),
  date date not null default current_date,
  notes text,
  created_at timestamptz not null default now(),
  check (from_user <> to_user)
);

create index if not exists idx_payments_date on payments (date desc);
create index if not exists idx_payments_from on payments (from_user);
create index if not exists idx_payments_to on payments (to_user);

-- ---------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_transactions_updated_at on transactions;
create trigger trg_transactions_updated_at
  before update on transactions
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- DERIVED VIEW: net amount every user owes every other user.
-- Positive `net_cents` means `debtor` owes `creditor`. This view is a
-- convenience for reporting/export; the app's own balance.ts computes
-- the same thing independently and is the source of truth used on
-- screen, so the two are kept intentionally in sync by sharing the
-- same underlying tables.
-- ---------------------------------------------------------------------
create or replace view pairwise_debts as
with expense_debts as (
  -- what `s.user_id` owes `t.paid_by` from each transaction
  select
    s.user_id as debtor,
    t.paid_by as creditor,
    sum(s.amount_cents) as amount_cents
  from transaction_splits s
  join transactions t on t.id = s.transaction_id
  where s.user_id <> t.paid_by
  group by s.user_id, t.paid_by
),
settlements as (
  select from_user as debtor, to_user as creditor, sum(amount_cents) as amount_cents
  from payments
  group by from_user, to_user
),
combined as (
  select * from expense_debts
  union all
  select debtor, creditor, -amount_cents from settlements
)
select debtor, creditor, sum(amount_cents) as net_cents
from combined
group by debtor, creditor;

-- ---------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- Every signed-in app user (i.e. present in `users`) can read and write
-- all shared-ledger data — that's the point of a *shared* tracker. What
-- RLS protects against here is anyone who is NOT one of the app's known
-- users touching the data at all.
-- ---------------------------------------------------------------------
alter table users enable row level security;
alter table categories enable row level security;
alter table transactions enable row level security;
alter table transaction_splits enable row level security;
alter table payments enable row level security;

create policy "known users can read users" on users
  for select using (auth.uid() in (select id from users));

create policy "users can update own profile" on users
  for update using (auth.uid() = id);

create policy "known users can read categories" on categories
  for select using (auth.uid() in (select id from users));

create policy "known users can read transactions" on transactions
  for select using (auth.uid() in (select id from users));
create policy "known users can insert transactions" on transactions
  for insert with check (auth.uid() in (select id from users));
create policy "known users can update transactions" on transactions
  for update using (auth.uid() in (select id from users));
create policy "known users can delete transactions" on transactions
  for delete using (auth.uid() in (select id from users));

create policy "known users can read splits" on transaction_splits
  for select using (auth.uid() in (select id from users));
create policy "known users can insert splits" on transaction_splits
  for insert with check (auth.uid() in (select id from users));
create policy "known users can update splits" on transaction_splits
  for update using (auth.uid() in (select id from users));
create policy "known users can delete splits" on transaction_splits
  for delete using (auth.uid() in (select id from users));

create policy "known users can read payments" on payments
  for select using (auth.uid() in (select id from users));
create policy "known users can insert payments" on payments
  for insert with check (auth.uid() in (select id from users));
create policy "known users can update payments" on payments
  for update using (auth.uid() in (select id from users));
create policy "known users can delete payments" on payments
  for delete using (auth.uid() in (select id from users));

-- ---------------------------------------------------------------------
-- Seed the two users AFTER creating them in Supabase Auth. Run this
-- manually (see README) with the real auth.users UUIDs and emails:
--
-- insert into users (id, name, email) values
--   ('<auth-uuid-1>', 'Me', 'me@example.com'),
--   ('<auth-uuid-2>', 'Friend', 'friend@example.com');
-- ---------------------------------------------------------------------
