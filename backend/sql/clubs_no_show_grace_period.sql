ALTER TABLE public.clubs
ADD COLUMN IF NOT EXISTS no_show_grace_period_minutes integer NOT NULL DEFAULT 30;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'clubs_no_show_grace_period_minutes_range'
  ) THEN
    ALTER TABLE public.clubs
    ADD CONSTRAINT clubs_no_show_grace_period_minutes_range
    CHECK (no_show_grace_period_minutes BETWEEN 1 AND 240);
  END IF;
END $$;
