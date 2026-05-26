-- RLS for public.tables: club managers can CRUD rows for their venue.
-- Fixes: "new row violates row-level security policy for table 'tables'"
--
-- Run the FULL script in Supabase → SQL Editor (as postgres). Safe to re-run.
--
-- Why a SECURITY DEFINER helper?
-- Inline "EXISTS (SELECT ... FROM profiles ...)" in policies can fail if profiles RLS,
-- search_path, or evaluation quirks hide the row. A small STABLE helper owned by postgres
-- reliably reads profiles for the current auth.uid().
--
-- Expects: profiles(id uuid PK, role text, club_id uuid) with managers having
-- lower(trim(role)) = 'manager' and club_id set.

ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Helper: true if current user is a manager and owns this club
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_manage_club_tables(target_club_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND lower(trim(coalesce(p.role, ''))) = 'manager'
      AND p.club_id IS NOT NULL
      AND p.club_id = target_club_id
  );
$$;

REVOKE ALL ON FUNCTION public.can_manage_club_tables(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_club_tables(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_club_tables(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Policies (drop + recreate)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "tables_manager_select_own_club" ON public.tables;
DROP POLICY IF EXISTS "tables_manager_insert_own_club" ON public.tables;
DROP POLICY IF EXISTS "tables_manager_update_own_club" ON public.tables;
DROP POLICY IF EXISTS "tables_manager_delete_own_club" ON public.tables;

CREATE POLICY "tables_manager_select_own_club"
ON public.tables
FOR SELECT
TO authenticated
USING (public.can_manage_club_tables(club_id));

CREATE POLICY "tables_manager_insert_own_club"
ON public.tables
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_club_tables(club_id));

CREATE POLICY "tables_manager_update_own_club"
ON public.tables
FOR UPDATE
TO authenticated
USING (public.can_manage_club_tables(club_id))
WITH CHECK (public.can_manage_club_tables(club_id));

CREATE POLICY "tables_manager_delete_own_club"
ON public.tables
FOR DELETE
TO authenticated
USING (public.can_manage_club_tables(club_id));

-- ---------------------------------------------------------------------------
-- Optional checks if INSERT still fails after running this script:
--
-- 1) Manager profile row (Table Editor → profiles, filter by your user id):
--    role should be exactly 'manager' (any case). club_id must match tables.club_id.
--
-- 2) No other RESTRICTIVE policies on public.tables blocking the operation.
--
-- 3) club_id on the new table row must equal your profiles.club_id (the app sets this).
-- ---------------------------------------------------------------------------
