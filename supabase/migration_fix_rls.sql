-- Fixes a circular RLS policy: querying `users` inside its own SELECT
-- policy (and inside every other table's policies) deadlocks under
-- Postgres RLS and silently returns zero rows to everyone. This
-- SECURITY DEFINER helper checks membership without re-triggering RLS.

create or replace function public.is_known_user()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from users where id = auth.uid());
$$;

drop policy if exists "known users can read users" on users;
create policy "known users can read users" on users
  for select using (public.is_known_user());

drop policy if exists "known users can read categories" on categories;
create policy "known users can read categories" on categories
  for select using (public.is_known_user());

drop policy if exists "known users can read transactions" on transactions;
create policy "known users can read transactions" on transactions
  for select using (public.is_known_user());
drop policy if exists "known users can insert transactions" on transactions;
create policy "known users can insert transactions" on transactions
  for insert with check (public.is_known_user());
drop policy if exists "known users can update transactions" on transactions;
create policy "known users can update transactions" on transactions
  for update using (public.is_known_user());
drop policy if exists "known users can delete transactions" on transactions;
create policy "known users can delete transactions" on transactions
  for delete using (public.is_known_user());

drop policy if exists "known users can read splits" on transaction_splits;
create policy "known users can read splits" on transaction_splits
  for select using (public.is_known_user());
drop policy if exists "known users can insert splits" on transaction_splits;
create policy "known users can insert splits" on transaction_splits
  for insert with check (public.is_known_user());
drop policy if exists "known users can update splits" on transaction_splits;
create policy "known users can update splits" on transaction_splits
  for update using (public.is_known_user());
drop policy if exists "known users can delete splits" on transaction_splits;
create policy "known users can delete splits" on transaction_splits
  for delete using (public.is_known_user());

drop policy if exists "known users can read payments" on payments;
create policy "known users can read payments" on payments
  for select using (public.is_known_user());
drop policy if exists "known users can insert payments" on payments;
create policy "known users can insert payments" on payments
  for insert with check (public.is_known_user());
drop policy if exists "known users can update payments" on payments;
create policy "known users can update payments" on payments
  for update using (public.is_known_user());
drop policy if exists "known users can delete payments" on payments;
create policy "known users can delete payments" on payments
  for delete using (public.is_known_user());
