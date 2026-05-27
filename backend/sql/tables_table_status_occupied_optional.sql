-- Optional: allow native `occupied` on `public.tables.table_status`.
-- Run in Supabase SQL Editor only if updates to `occupied` fail with a check constraint.
-- Adjust allowed values to match your existing policy.

-- Example: discover constraint name
-- SELECT conname FROM pg_constraint c
-- JOIN pg_class rel ON rel.oid = c.conrelid
-- WHERE rel.relname = 'tables' AND c.contype = 'c';

ALTER TABLE public.tables DROP CONSTRAINT IF EXISTS tables_table_status_check;

ALTER TABLE public.tables ADD CONSTRAINT tables_table_status_check CHECK (
  table_status IS NULL
  OR lower(trim(table_status)) IN (
    'available',
    'reserved',
    'occupied',
    'booked',
    'seated'
  )
);
