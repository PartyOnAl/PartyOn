-- Run this in Supabase SQL editor if clearing a finished dispute fails with:
-- "Could not find the 'user_cleared_at' column of 'disputes' in the schema cache"

alter table if exists public.disputes
  add column if not exists user_cleared_at timestamptz;

notify pgrst, 'reload schema';
