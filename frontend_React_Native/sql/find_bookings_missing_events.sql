-- Find bookings that would show as "-" in the Tickets/Reservations page.
-- Replace the auth.uid() condition with a concrete user id if you are running
-- this as an admin outside an authenticated user context.

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
where r.user_id = auth.uid()
  and (
    r.event_id is null
    or e.event_id is null
    or nullif(trim(e.event_name), '') is null
  )
order by r.created_at desc;
