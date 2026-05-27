-- Optional detail columns for the catalog `events` table (all nullable).
-- Run in Supabase SQL editor if your events row is missing these fields.
-- Table name matches CATALOG_EVENT_TABLE (default: public.events).
-- rating DECIMAL(2,1) max 9.9; use NUMERIC(3,1) in a follow-up ALTER if you need 10.0.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS end_time TIME,
  ADD COLUMN IF NOT EXISTS organizer VARCHAR(255),
  ADD COLUMN IF NOT EXISTS age_restriction VARCHAR(64),
  ADD COLUMN IF NOT EXISTS lineup JSONB,
  ADD COLUMN IF NOT EXISTS special_guests JSONB,
  ADD COLUMN IF NOT EXISTS dress_code VARCHAR(255),
  ADD COLUMN IF NOT EXISTS rating DECIMAL(2, 1),
  ADD COLUMN IF NOT EXISTS review_count INT,
  ADD COLUMN IF NOT EXISTS ticket_required BOOLEAN;

-- If you prefer Postgres text[] instead of JSONB for arrays, use instead:
-- ALTER TABLE public.events ADD COLUMN IF NOT EXISTS lineup TEXT[];
-- ALTER TABLE public.events ADD COLUMN IF NOT EXISTS special_guests TEXT[];
