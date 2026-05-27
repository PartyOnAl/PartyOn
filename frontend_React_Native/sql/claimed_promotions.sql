-- ── claimed_promotions ────────────────────────────────────────────────────────
-- Tracks offers/promotions a user has claimed so they can redeem them at the
-- venue door. Each row has a unique short redemption code that the venue scans
-- (QR generated client-side from this code).
--
-- Run this once in the Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.claimed_promotions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  promotion_id    uuid not null references public.promotions(promotion_id) on delete cascade,
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

-- (Optional) allow club managers / staff to mark claims as redeemed.
-- Adjust the role check to match how your app stores manager/staff roles.
-- drop policy if exists "Venue staff can mark claims redeemed" on public.claimed_promotions;
-- create policy "Venue staff can mark claims redeemed"
--   on public.claimed_promotions for update
--   using (
--     exists (
--       select 1
--         from public.promotions p
--         join public.profiles pr on pr.club_id = p.club_id
--        where p.promotion_id = claimed_promotions.promotion_id
--          and pr.id = auth.uid()
--          and pr.role in ('manager', 'staff', 'doorstaff')
--     )
--   );
