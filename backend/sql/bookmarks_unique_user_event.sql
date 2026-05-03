-- Add if missing: one bookmark row per user+event when `id` is the sole PK.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookmarks_user_id_event_id_key'
      AND conrelid = 'public.bookmarks'::regclass
  ) THEN
    ALTER TABLE public.bookmarks
      ADD CONSTRAINT bookmarks_user_id_event_id_key UNIQUE (user_id, event_id);
  END IF;
END $$;
