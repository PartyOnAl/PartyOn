-- Keep claimed offers visible after a manager archives or drafts the promotion.
--
-- Public discovery should still be controlled by the app filters/status policies,
-- but a user who already claimed an offer needs to read that promotion row so the
-- title, image, venue, dates, and redemption details can render in "Your Nights".

alter table public.promotions enable row level security;

-- Claims must survive manager cleanup. The app archives promotions for manager
-- deletion, but this also prevents a hard delete from cascading into user offers
-- while claims exist.
do $$
declare
  fk_name text;
begin
  select tc.constraint_name
    into fk_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name
     and tc.table_schema = kcu.table_schema
     and tc.table_name = kcu.table_name
   where tc.table_schema = 'public'
     and tc.table_name = 'claimed_promotions'
     and tc.constraint_type = 'FOREIGN KEY'
     and kcu.column_name = 'promotion_id'
   limit 1;

  if fk_name is not null then
    execute format('alter table public.claimed_promotions drop constraint %I', fk_name);
  end if;

  alter table public.claimed_promotions
    add constraint claimed_promotions_promotion_id_fkey
    foreign key (promotion_id)
    references public.promotions(promotion_id)
    on delete restrict;
exception
  when duplicate_object then null;
end $$;

drop policy if exists "Users can view promotions they claimed" on public.promotions;
create policy "Users can view promotions they claimed"
  on public.promotions for select
  using (
    exists (
      select 1
        from public.claimed_promotions cp
       where cp.promotion_id = promotions.promotion_id
         and cp.user_id = auth.uid()
         and cp.status <> 'cancelled'
    )
  );
