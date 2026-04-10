-- JWT "sub" is always auth.users.id. If bookmarks.user_id pointed at public.profiles
-- (or another table) and no profile row exists yet, inserts fail with bookmarks_user_id_fkey.
-- This repoints the FK to Supabase Auth users.

ALTER TABLE public.bookmarks
  DROP CONSTRAINT IF EXISTS bookmarks_user_id_fkey;

ALTER TABLE public.bookmarks
  ADD CONSTRAINT bookmarks_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users (id)
  ON DELETE CASCADE;
