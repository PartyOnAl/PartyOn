-- ── claimed_promotions ────────────────────────────────────────────────────────
-- Tracks offers/promotions a user has claimed so they can redeem them at the
-- venue door. Each row has a unique short redemption code that the venue scans
-- (QR generated client-side from this code).
--
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → Run).

create extension if not exists pgcrypto;

create table if not exists public.claimed_promotions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  promotion_id    uuid not null references public.promotions(promotion_id) on delete restrict,
  redemption_code text not null unique default encode(gen_random_bytes(6), 'hex'),
  status          text not null default 'active'
                    check (status in ('active', 'redeemed', 'expired', 'cancelled')),
  claimed_at      timestamptz not null default now(),
  redeemed_at     timestamptz,
  redeemed_by     uuid references auth.users(id),
  notes           text,
  unique (user_id, promotion_id)
);

create index if not exists claimed_promotions_user_idx
  on public.claimed_promotions (user_id, claimed_at desc);

create index if not exists claimed_promotions_promo_idx
  on public.claimed_promotions (promotion_id);

alter table public.claimed_promotions
  add column if not exists rating integer check (rating between 1 and 5),
  add column if not exists review_comment text,
  add column if not exists reviewed_at timestamptz;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.claimed_promotions enable row level security;

drop policy if exists "Users can view their own claims" on public.claimed_promotions;
create policy "Users can view their own claims"
  on public.claimed_promotions for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own claims" on public.claimed_promotions;
create policy "Users can create their own claims"
  on public.claimed_promotions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can cancel their own claims" on public.claimed_promotions;
create policy "Users can cancel their own claims"
  on public.claimed_promotions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Users who already claimed an offer should still be able to read the linked
-- promotion after the manager archives it (soft-deletes). Discovery remains
-- controlled by public promotion queries and app filters.
alter table public.promotions enable row level security;

drop policy if exists "Users can view promotions they claimed" on public.promotions;
create policy "Users can view promotions they claimed"
  on public.promotions for select
  using (
    exists (
      select 1
        from public.claimed_promotions cp
       where cp.promotion_id = promotions.promotion_id
         and cp.user_id = auth.uid()
         and cp.status <> 'cancelled'
    )
  );

-- ── Soft-delete support ───────────────────────────────────────────────────────
-- Add deleted_at column if it doesn't exist yet. Managers archive promotions
-- instead of hard-deleting so claimed_promotions rows are preserved.
alter table public.promotions
  add column if not exists deleted_at timestamptz default null;

-- The FK from claimed_promotions to promotions must be ON DELETE RESTRICT
-- so a manager cannot hard-delete a promotion that has active claims.
-- Re-create the constraint to ensure the correct behaviour.
do $$
declare
  fk_name text;
begin
  select tc.constraint_name
    into fk_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name
     and tc.table_schema = kcu.table_schema
     and tc.table_name = kcu.table_name
   where tc.table_schema = 'public'
     and tc.table_name = 'claimed_promotions'
     and tc.constraint_type = 'FOREIGN KEY'
     and kcu.column_name = 'promotion_id'
   limit 1;

  if fk_name is not null then
    execute format('alter table public.claimed_promotions drop constraint %I', fk_name);
  end if;

  alter table public.claimed_promotions
    add constraint claimed_promotions_promotion_id_fkey
    foreign key (promotion_id)
    references public.promotions(promotion_id)
    on delete restrict;
exception
  when duplicate_object then null;
end $$;
