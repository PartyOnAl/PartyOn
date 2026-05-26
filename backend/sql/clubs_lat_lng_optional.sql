-- Optional: add coordinates so "Clubs near you" can compute distance after "Use my location".
-- Primary columns: `club_lat` / `club_lng` on `public.clubs` (API maps these first; legacy `lat`/`lng` still read as fallback).

-- ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS club_lat double precision;
-- ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS club_lng double precision;

-- UPDATE public.clubs SET club_lat = 41.3231, club_lng = 19.4414 WHERE club_name = 'Example Club';
