-- Allows platform admins to send custom subscription offers to managers via
-- the existing notifications inbox.
--
-- Run this in Supabase SQL editor if the Subscription Offers page reports an
-- insert permissions error.

drop policy if exists "Admins can insert manager notifications" on public.notifications;
grant insert on public.notifications to authenticated;

create policy "Admins can insert manager notifications"
  on public.notifications for insert
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );
