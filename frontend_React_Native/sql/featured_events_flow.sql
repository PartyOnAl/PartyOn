-- Featured events approval/payment flow.
-- Run this in Supabase SQL Editor before using the new manager/admin flow.

alter table public.events
  add column if not exists featured_request_status text not null default 'none',
  add column if not exists featured_requested_at timestamptz,
  add column if not exists featured_paid_at timestamptz,
  add column if not exists featured_reviewed_at timestamptz,
  add column if not exists featured_rejection_reason text,
  add column if not exists featured_fee_amount numeric(10,2),
  add column if not exists featured_fee_paid boolean not null default false;

alter table public.events
  drop constraint if exists events_featured_request_status_check;

alter table public.events
  add constraint events_featured_request_status_check
  check (featured_request_status in ('none', 'pending_review', 'approved', 'rejected', 'cancelled'));

update public.events
set featured_request_status = 'approved',
    featured_fee_paid = true,
    featured_reviewed_at = coalesce(featured_reviewed_at, updated_at, now())
where is_featured = true
  and featured_request_status = 'none';

create index if not exists idx_events_featured_status
  on public.events (featured_request_status, is_featured, event_starting_date);

