-- ── notifications + push_tokens ──────────────────────────────────────────────
-- In-app notification inbox for managers (and other roles), plus Expo push
-- token registry for delivery. Triggers populate notifications when domain
-- events happen (new reservation, dispute change, etc.).
--
-- Run this once in the Supabase SQL editor.

create extension if not exists pgcrypto;

-- ─── notifications ──────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id                    uuid primary key default gen_random_uuid(),
  recipient_profile_id  uuid not null references public.profiles(id) on delete cascade,
  club_id               uuid references public.clubs(club_id) on delete cascade,
  type                  text not null
                          check (type in (
                            'reservation_new',
                            'reservation_cancelled',
                            'dispute_new',
                            'dispute_update',
                            'promotion_expiring',
                            'subscription_due',
                            'event_published',
                            'payment_received',
                            'generic'
                          )),
  title                 text not null,
  body                  text,
  data                  jsonb not null default '{}'::jsonb,
  read_at               timestamptz,
  created_at            timestamptz not null default now()
);

create index if not exists notifications_recipient_idx
  on public.notifications (recipient_profile_id, created_at desc);

create index if not exists notifications_recipient_unread_idx
  on public.notifications (recipient_profile_id, read_at)
  where read_at is null;

create index if not exists notifications_club_idx
  on public.notifications (club_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "Recipients can read their notifications" on public.notifications;
create policy "Recipients can read their notifications"
  on public.notifications for select
  using (auth.uid() = recipient_profile_id);

drop policy if exists "Recipients can update read state" on public.notifications;
create policy "Recipients can update read state"
  on public.notifications for update
  using (auth.uid() = recipient_profile_id)
  with check (auth.uid() = recipient_profile_id);

drop policy if exists "Recipients can delete their notifications" on public.notifications;
create policy "Recipients can delete their notifications"
  on public.notifications for delete
  using (auth.uid() = recipient_profile_id);

-- Inserts are performed by triggers (security definer) and by service role.
-- No insert policy needed for end users.

-- Enable realtime so the bell badge updates live
alter publication supabase_realtime add table public.notifications;

-- ─── push_tokens ────────────────────────────────────────────────────────────
create table if not exists public.push_tokens (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  expo_token    text not null unique,
  device_label  text,
  platform      text check (platform in ('ios', 'android', 'web')),
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);

create index if not exists push_tokens_profile_idx
  on public.push_tokens (profile_id);

alter table public.push_tokens enable row level security;

drop policy if exists "Users manage their own push tokens (select)" on public.push_tokens;
create policy "Users manage their own push tokens (select)"
  on public.push_tokens for select
  using (auth.uid() = profile_id);

drop policy if exists "Users manage their own push tokens (insert)" on public.push_tokens;
create policy "Users manage their own push tokens (insert)"
  on public.push_tokens for insert
  with check (auth.uid() = profile_id);

drop policy if exists "Users manage their own push tokens (update)" on public.push_tokens;
create policy "Users manage their own push tokens (update)"
  on public.push_tokens for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

drop policy if exists "Users manage their own push tokens (delete)" on public.push_tokens;
create policy "Users manage their own push tokens (delete)"
  on public.push_tokens for delete
  using (auth.uid() = profile_id);

-- ─── helper: resolve manager profile_id for a club ──────────────────────────
create or replace function public.fn_club_manager_id(p_club_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select manager_id from public.clubs where club_id = p_club_id;
$$;

-- ─── trigger: new reservation -> notify club manager ───────────────────────
create or replace function public.fn_notify_reservation_new()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club_id     uuid;
  v_manager     uuid;
  v_event_name  text;
  v_guest_name  text;
begin
  select e.club_id, e.event_name
    into v_club_id, v_event_name
  from public.events e
  where e.event_id = new.event_id;

  if v_club_id is null then return new; end if;

  v_manager := public.fn_club_manager_id(v_club_id);
  if v_manager is null then return new; end if;

  select coalesce(nullif(trim(coalesce(p.name, '') || ' ' || coalesce(p.surname, '')), ''), 'Someone')
    into v_guest_name
  from public.profiles p
  where p.id = new.user_id;

  insert into public.notifications (
    recipient_profile_id, club_id, type, title, body, data
  ) values (
    v_manager,
    v_club_id,
    'reservation_new',
    'New reservation',
    coalesce(v_guest_name, 'A guest') || ' booked ' ||
      (case when new.type = 'table' then 'a table' else 'a ticket' end) ||
      coalesce(' for ' || v_event_name, ''),
    jsonb_build_object(
      'reservation_id', new.reservation_id,
      'event_id',       new.event_id,
      'type',           new.type,
      'status',         new.status
    )
  );

  return new;
end
$$;

drop trigger if exists trg_notify_reservation_new on public.reservations;
create trigger trg_notify_reservation_new
  after insert on public.reservations
  for each row execute function public.fn_notify_reservation_new();

-- ─── trigger: reservation cancelled -> notify club manager ──────────────────
create or replace function public.fn_notify_reservation_cancelled()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club_id     uuid;
  v_manager     uuid;
  v_event_name  text;
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.status <> 'cancelled' then return new; end if;

  select e.club_id, e.event_name
    into v_club_id, v_event_name
  from public.events e
  where e.event_id = new.event_id;

  if v_club_id is null then return new; end if;

  v_manager := public.fn_club_manager_id(v_club_id);
  if v_manager is null then return new; end if;

  insert into public.notifications (
    recipient_profile_id, club_id, type, title, body, data
  ) values (
    v_manager,
    v_club_id,
    'reservation_cancelled',
    'Reservation cancelled',
    'A reservation' || coalesce(' for ' || v_event_name, '') || ' was cancelled.',
    jsonb_build_object(
      'reservation_id', new.reservation_id,
      'event_id',       new.event_id
    )
  );

  return new;
end
$$;

drop trigger if exists trg_notify_reservation_cancelled on public.reservations;
create trigger trg_notify_reservation_cancelled
  after update of status on public.reservations
  for each row execute function public.fn_notify_reservation_cancelled();

-- ─── trigger: new dispute -> notify club manager ───────────────────────────
create or replace function public.fn_notify_dispute_new()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manager uuid;
begin
  if new.club_id is null then return new; end if;
  v_manager := public.fn_club_manager_id(new.club_id);
  if v_manager is null then return new; end if;

  insert into public.notifications (
    recipient_profile_id, club_id, type, title, body, data
  ) values (
    v_manager,
    new.club_id,
    'dispute_new',
    'New dispute opened',
    'A customer opened a dispute that needs your attention.',
    jsonb_build_object('dispute_id', new.id, 'status', new.status)
  );

  return new;
end
$$;

drop trigger if exists trg_notify_dispute_new on public.disputes;
create trigger trg_notify_dispute_new
  after insert on public.disputes
  for each row execute function public.fn_notify_dispute_new();

-- ─── trigger: dispute updated -> notify club manager on status change ──────
create or replace function public.fn_notify_dispute_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manager uuid;
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.club_id is null then return new; end if;

  v_manager := public.fn_club_manager_id(new.club_id);
  if v_manager is null then return new; end if;

  insert into public.notifications (
    recipient_profile_id, club_id, type, title, body, data
  ) values (
    v_manager,
    new.club_id,
    'dispute_update',
    'Dispute status changed',
    'A dispute is now ' || new.status || '.',
    jsonb_build_object('dispute_id', new.id, 'status', new.status)
  );

  return new;
end
$$;

drop trigger if exists trg_notify_dispute_update on public.disputes;
create trigger trg_notify_dispute_update
  after update of status on public.disputes
  for each row execute function public.fn_notify_dispute_update();

-- ─── trigger: event published -> notify club manager ───────────────────────
create or replace function public.fn_notify_event_published()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manager uuid;
begin
  if new.event_status <> 'published' then return new; end if;
  if old.event_status = 'published' then return new; end if;
  if new.club_id is null then return new; end if;

  v_manager := public.fn_club_manager_id(new.club_id);
  if v_manager is null then return new; end if;

  insert into public.notifications (
    recipient_profile_id, club_id, type, title, body, data
  ) values (
    v_manager,
    new.club_id,
    'event_published',
    'Event published',
    coalesce(new.event_name, 'Your event') || ' is now live.',
    jsonb_build_object('event_id', new.event_id)
  );

  return new;
end
$$;

drop trigger if exists trg_notify_event_published on public.events;
create trigger trg_notify_event_published
  after update of event_status on public.events
  for each row execute function public.fn_notify_event_published();

-- ─── scheduled checks: promotions expiring + subscription due ──────────────
-- Idempotent: refuses to insert duplicates for the same (club, type, day).
create or replace function public.fn_notify_daily_checks()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_today date := current_date;
begin
  -- Promotions expiring in <= 3 days
  for r in
    select p.promotion_id, p.title, p.valid_until, p.club_id, c.manager_id
      from public.promotions p
      join public.clubs c on c.club_id = p.club_id
     where p.status in ('active', 'approved')
       and p.valid_until is not null
       and p.valid_until::date - v_today between 0 and 3
       and c.manager_id is not null
  loop
    if not exists (
      select 1 from public.notifications n
       where n.recipient_profile_id = r.manager_id
         and n.type = 'promotion_expiring'
         and (n.data->>'promotion_id')::uuid = r.promotion_id
         and n.created_at::date = v_today
    ) then
      insert into public.notifications (
        recipient_profile_id, club_id, type, title, body, data
      ) values (
        r.manager_id,
        r.club_id,
        'promotion_expiring',
        'Promotion expiring soon',
        coalesce(r.title, 'A promotion') || ' ends on ' || to_char(r.valid_until::date, 'DD Mon') || '.',
        jsonb_build_object('promotion_id', r.promotion_id)
      );
    end if;
  end loop;

  -- Subscriptions due in <= 14 days (or already overdue)
  for r in
    select c.club_id, c.manager_id, c.subscription_due_date
      from public.clubs c
     where c.manager_id is not null
       and c.subscription_due_date is not null
       and c.subscription_due_date::date - v_today <= 14
  loop
    if not exists (
      select 1 from public.notifications n
       where n.recipient_profile_id = r.manager_id
         and n.type = 'subscription_due'
         and n.club_id = r.club_id
         and n.created_at::date = v_today
    ) then
      insert into public.notifications (
        recipient_profile_id, club_id, type, title, body, data
      ) values (
        r.manager_id,
        r.club_id,
        'subscription_due',
        case
          when r.subscription_due_date::date < v_today then 'Subscription overdue'
          else 'Subscription due soon'
        end,
        'Renew to keep your club listed. Due ' || to_char(r.subscription_due_date::date, 'DD Mon YYYY') || '.',
        jsonb_build_object('subscription_due_date', r.subscription_due_date)
      );
    end if;
  end loop;
end
$$;

-- Schedule daily at 09:00 UTC. Requires pg_cron (Supabase: enabled by default).
-- If pg_cron is unavailable, call select public.fn_notify_daily_checks(); from
-- a scheduled Edge Function instead.
do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('notifications_daily_checks')
      where exists (select 1 from cron.job where jobname = 'notifications_daily_checks');
    perform cron.schedule(
      'notifications_daily_checks',
      '0 9 * * *',
      $job$ select public.fn_notify_daily_checks(); $job$
    );
  end if;
end
$cron$;
