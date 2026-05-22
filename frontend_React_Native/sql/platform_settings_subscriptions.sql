-- Platform settings table used by admin and manager screens.
-- This does not seed subscription prices. Admin Settings is the source of
-- truth: when the admin saves Monthly / 3-Month prices in the app, those
-- values are stored here and managers read them.

create table if not exists public.platform_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

alter table public.platform_settings enable row level security;

grant select on public.platform_settings to anon, authenticated;
grant insert, update on public.platform_settings to authenticated;

drop policy if exists "Anyone can read platform settings" on public.platform_settings;
create policy "Anyone can read platform settings"
  on public.platform_settings for select
  using (true);

drop policy if exists "Admins can manage platform settings" on public.platform_settings;
create policy "Admins can manage platform settings"
  on public.platform_settings for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

notify pgrst, 'reload schema';
