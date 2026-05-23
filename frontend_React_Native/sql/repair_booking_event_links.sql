-- Repair booking rows that are missing event details.
-- Safe pass: infer reservations.event_id from ticket_types.event_id whenever possible.

begin;

update public.reservations r
set event_id = tt.event_id
from public.ticket_types tt
where r.ticket_type_id = tt.id
  and tt.event_id is not null
  and (r.event_id is null or r.event_id <> tt.event_id);

-- Rows returned here still need manual review. They cannot be safely linked
-- without knowing which event the user actually booked.
select
  r.reservation_id,
  r.user_id,
  r.event_id,
  r.type,
  r.ticket_type_id,
  r.status,
  r.created_at
from public.reservations r
left join public.events e on e.event_id = r.event_id
where r.event_id is null
  or e.event_id is null
  or nullif(trim(e.event_name), '') is null
order by r.created_at desc;

commit;

notify pgrst, 'reload schema';
