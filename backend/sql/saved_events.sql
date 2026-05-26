-- Run in Supabase SQL Editor (once). Nest uses the service role (bypasses RLS).
CREATE TABLE IF NOT EXISTS public.saved_events (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  event_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_id)
);

CREATE INDEX IF NOT EXISTS saved_events_user_id_idx ON public.saved_events (user_id);

ALTER TABLE public.saved_events ENABLE ROW LEVEL SECURITY;

-- Optional: lets authenticated users use Supabase client directly on this table later.
CREATE POLICY "Users manage own saved events"
  ON public.saved_events
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
