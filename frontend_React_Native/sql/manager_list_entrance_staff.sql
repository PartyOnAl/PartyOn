-- ─── Manager: list entrance staff (host / door team) ─────────────────────────
-- Typical issue: profiles RLS lets users read only their own row, so managers never
-- see other club members. This SECURITY DEFINER function restricts results to callers
-- who manage the requested club via clubs.manager_id OR their own manager profile row.
--
-- Run once in the Supabase SQL editor (requires appropriate ownership / postgres role).

CREATE OR REPLACE FUNCTION public.manager_list_entrance_staff(target_club_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  surname text,
  email text,
  phone_number text,
  role text,
  club_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.name,
    p.surname,
    p.email,
    p.phone_number,
    p.role,
    p.club_id
  FROM public.profiles p
  INNER JOIN public.clubs c ON c.club_id = p.club_id
  WHERE p.club_id = target_club_id
    AND (
      c.manager_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.profiles mgr
        WHERE mgr.id = auth.uid()
          AND lower(trim(coalesce(mgr.role, ''))) = 'manager'
          AND mgr.club_id = target_club_id
      )
    )
    AND lower(trim(coalesce(p.role, ''))) NOT IN ('manager', 'admin', 'user')
  ORDER BY p.name NULLS LAST, p.email NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.manager_list_entrance_staff(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.manager_list_entrance_staff(uuid) TO authenticated;
