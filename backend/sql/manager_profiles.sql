-- Dedicated manager profile details.
-- Keep auth/authorization fields in profiles; store manager-editable UI fields here.

CREATE TABLE IF NOT EXISTS public.manager_profiles (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text,
  surname text,
  username text,
  phone_number text,
  birth_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.manager_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers can view own manager profile" ON public.manager_profiles;
CREATE POLICY "Managers can view own manager profile"
ON public.manager_profiles
FOR SELECT
USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS "Managers can insert own manager profile" ON public.manager_profiles;
CREATE POLICY "Managers can insert own manager profile"
ON public.manager_profiles
FOR INSERT
WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "Managers can update own manager profile" ON public.manager_profiles;
CREATE POLICY "Managers can update own manager profile"
ON public.manager_profiles
FOR UPDATE
USING (auth.uid() = profile_id)
WITH CHECK (auth.uid() = profile_id);
