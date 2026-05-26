alter table public.clubs
  add column if not exists reservation_hold_minutes integer not null default 30;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'clubs_reservation_hold_minutes_range'
  ) then
    alter table public.clubs
      add constraint clubs_reservation_hold_minutes_range
      check (reservation_hold_minutes between 0 and 240);
  end if;
end $$;

update public.clubs
set reservation_hold_minutes = 30
where reservation_hold_minutes is null;
