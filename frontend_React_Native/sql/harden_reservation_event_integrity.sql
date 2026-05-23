-- Long-term fix for booking rows showing without event details.
-- This repairs existing rows where possible and prevents new invalid app
-- bookings from being written.

begin;

-- 1) Repair existing ticket bookings whose event can be inferred from ticket type.
update public.reservations r
set event_id = tt.event_id,
    type = 'ticket'
from public.ticket_types tt
where r.ticket_type_id = tt.id
  and tt.event_id is not null
  and (r.event_id is null or r.event_id <> tt.event_id or r.type is distinct from 'ticket');

-- 2) Repair table booking type where the row clearly has a table.
update public.reservations
set type = 'table'
where table_id is not null
  and ticket_type_id is null
  and type is distinct from 'table';

-- 3) Add foreign keys so rows cannot point at deleted/missing event/ticket types.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.reservations'::regclass
      and conname = 'reservations_event_id_fkey'
  ) then
    alter table public.reservations
      add constraint reservations_event_id_fkey
      foreign key (event_id) references public.events(event_id)
      on delete restrict
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.reservations'::regclass
      and conname = 'reservations_ticket_type_id_fkey'
  ) then
    alter table public.reservations
      add constraint reservations_ticket_type_id_fkey
      foreign key (ticket_type_id) references public.ticket_types(id)
      on delete restrict
      not valid;
  end if;
end
$$;

-- 4) Normalize and validate every new/edited reservation.
create or replace function public.fn_normalize_reservation_event_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket_event uuid;
  v_event_exists boolean;
begin
  if new.ticket_type_id is not null then
    select tt.event_id into v_ticket_event
    from public.ticket_types tt
    where tt.id = new.ticket_type_id;

    if v_ticket_event is null then
      raise exception 'Invalid ticket type for reservation';
    end if;

    new.event_id := v_ticket_event;
    new.type := 'ticket';
  end if;

  if new.type = 'ticket' and new.event_id is null then
    raise exception 'Ticket booking requires an event';
  end if;

  if new.type = 'table' and new.event_id is null then
    raise exception 'Table reservation requires an event';
  end if;

  if new.event_id is not null then
    select exists (
      select 1
      from public.events e
      where e.event_id = new.event_id
        and nullif(trim(e.event_name), '') is not null
    ) into v_event_exists;

    if not v_event_exists then
      raise exception 'Reservation event is missing or has no name';
    end if;
  end if;

  return new;
end
$$;

drop trigger if exists trg_normalize_reservation_event_link on public.reservations;
create trigger trg_normalize_reservation_event_link
  before insert or update of event_id, ticket_type_id, table_id, type
  on public.reservations
  for each row execute function public.fn_normalize_reservation_event_link();

-- 5) Report remaining historical rows that need manual correction.
select
  r.reservation_id,
  r.user_id,
  r.event_id,
  r.type,
  r.ticket_type_id,
  r.table_id,
  r.status,
  r.created_at
from public.reservations r
left join public.events e on e.event_id = r.event_id
left join public.ticket_types tt on tt.id = r.ticket_type_id
where r.event_id is null
   or e.event_id is null
   or nullif(trim(e.event_name), '') is null
   or (r.ticket_type_id is not null and tt.id is null)
order by r.created_at desc;

commit;

notify pgrst, 'reload schema';
