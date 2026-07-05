-- Run on Postgres (e.g. Supabase) so TypeORM `tables.seated` matches the database.
ALTER TABLE public.tables
ADD COLUMN IF NOT EXISTS seated integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.tables.seated IS
  'Hostess count of guests seated for the party at this table; clamped to reservation party size in app logic.';
