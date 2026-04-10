-- Optional: add coordinates so "Clubs near you" can compute distance after "Use my location".
-- Names must match what the API maps: latitude/longitude OR lat/lng OR club_latitude/club_longitude.
-- Example (pick one pair and stick to it):

-- ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS latitude double precision;
-- ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS longitude double precision;

-- UPDATE public.clubs SET latitude = 41.3231, longitude = 19.4414 WHERE club_name = 'Example Club';
