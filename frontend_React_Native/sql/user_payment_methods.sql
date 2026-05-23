-- Saved user payment method metadata.
-- Security note: store only non-sensitive card metadata. Never store full card
-- numbers or CVC values in this table. Production payments should use a
-- provider token such as a Stripe payment_method id.

create extension if not exists pgcrypto;

create table if not exists public.payment_methods (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  brand        text not null check (brand in ('visa', 'mastercard', 'amex', 'card')),
  last4        text not null check (last4 ~ '^[0-9]{4}$'),
  exp_month    text not null check (exp_month ~ '^(0[1-9]|1[0-2])$'),
  exp_year     text not null check (exp_year ~ '^[0-9]{2}$'),
  holder_name  text not null,
  is_default   boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists payment_methods_user_idx
  on public.payment_methods (user_id, created_at desc);

alter table public.payment_methods enable row level security;

grant select, insert, update, delete on public.payment_methods to authenticated;

drop policy if exists "Users can read own payment methods" on public.payment_methods;
create policy "Users can read own payment methods"
  on public.payment_methods for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create own payment methods" on public.payment_methods;
create policy "Users can create own payment methods"
  on public.payment_methods for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own payment methods" on public.payment_methods;
create policy "Users can update own payment methods"
  on public.payment_methods for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own payment methods" on public.payment_methods;
create policy "Users can delete own payment methods"
  on public.payment_methods for delete
  using (auth.uid() = user_id);
