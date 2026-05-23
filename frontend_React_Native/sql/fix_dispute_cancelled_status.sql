-- Run this in Supabase SQL editor if cancelling a dispute fails with:
-- "new row for relation disputes violates check constraint disputes_status_check"

do $$
declare
  r record;
begin
  if to_regclass('public.disputes') is null then
    raise exception 'public.disputes table does not exist';
  end if;

  alter table public.disputes
    drop constraint if exists disputes_status_check;

  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.disputes'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
      and pg_get_constraintdef(oid) ilike '%open%'
  loop
    execute format('alter table public.disputes drop constraint %I', r.conname);
  end loop;

  alter table public.disputes
    add constraint disputes_status_check
    check (status in ('open', 'in_progress', 'resolved', 'rejected', 'cancelled'));
end
$$;
