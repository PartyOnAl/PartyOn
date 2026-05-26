-- Reservation flow support (safe for projects that already have `public.reservations`).
-- Run in Supabase SQL Editor.

-- 1) Ensure table exists (new-schema style).
-- NOTE: references `events(event_id)` because this project uses `event_id` as PK.
CREATE TABLE IF NOT EXISTS public.reservations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  event_id uuid REFERENCES public.events(event_id),
  number_of_people integer NOT NULL DEFAULT 1,
  time_slot text,
  special_requests text,
  status text NOT NULL DEFAULT 'confirmed',
  reservation_reference text UNIQUE,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

-- 2) Backfill/compat for existing legacy reservations schema in this project.
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS reservation_reference text,
  ADD COLUMN IF NOT EXISTS number_of_people integer,
  ADD COLUMN IF NOT EXISTS time_slot text,
  ADD COLUMN IF NOT EXISTS special_requests text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT NOW();

UPDATE public.reservations
SET number_of_people = COALESCE(number_of_people, nr_of_people, 1)
WHERE number_of_people IS NULL;

UPDATE public.reservations
SET time_slot = COALESCE(time_slot, expected_arrival_time)
WHERE time_slot IS NULL;

UPDATE public.reservations
SET special_requests = COALESCE(special_requests, notes)
WHERE special_requests IS NULL;

UPDATE public.reservations
SET reservation_reference = COALESCE(reservation_reference, qr_code, ('RES-' || EXTRACT(YEAR FROM NOW())::text || '-LEGACY-' || left(COALESCE(id::text, reservation_id::text), 8)))
WHERE reservation_reference IS NULL;

ALTER TABLE public.reservations
  ALTER COLUMN number_of_people SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reservations_reservation_reference_key'
  ) THEN
    ALTER TABLE public.reservations
      ADD CONSTRAINT reservations_reservation_reference_key UNIQUE (reservation_reference);
  END IF;
END$$;

-- 3) RLS policies.
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own reservations" ON public.reservations;
CREATE POLICY "Users can insert their own reservations"
ON public.reservations FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own reservations" ON public.reservations;
CREATE POLICY "Users can view their own reservations"
ON public.reservations FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own reservations" ON public.reservations;
CREATE POLICY "Users can update their own reservations"
ON public.reservations FOR UPDATE
USING (auth.uid() = user_id);
