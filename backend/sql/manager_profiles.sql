-- Dedicated manager profile details.
-- Keep auth/authorization fields in profiles; store manager-editable UI fields here.

CREATE TABLE IF NOT EXISTS public.manager_profiles (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text,
  surname text,
  username text,
  email text,
  phone_number text,
  birth_date date,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.manager_profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS avatar_url text;

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

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'manager-avatars',
  'manager-avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

DROP POLICY IF EXISTS "Managers can view manager avatars" ON storage.objects;
CREATE POLICY "Managers can view manager avatars"
ON storage.objects
FOR SELECT
USING (bucket_id = 'manager-avatars');

DROP POLICY IF EXISTS "Managers can upload own manager avatar" ON storage.objects;
CREATE POLICY "Managers can upload own manager avatar"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'manager-avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Managers can update own manager avatar" ON storage.objects;
CREATE POLICY "Managers can update own manager avatar"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'manager-avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'manager-avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Managers can update own manager profile" ON public.manager_profiles;
CREATE POLICY "Managers can update own manager profile"
ON public.manager_profiles
FOR UPDATE
USING (auth.uid() = profile_id)
WITH CHECK (auth.uid() = profile_id);
