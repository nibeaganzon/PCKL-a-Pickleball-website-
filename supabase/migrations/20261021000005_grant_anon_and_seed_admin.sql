-- Migration 5: Anonymous Access Grants and Admin Registration
-- Grants public read access for courts, equipments, and reservations,
-- and registers the initial administrator into admin_members.

-- 1. Grant usage and select privileges to anon and authenticated roles
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON TABLE public.courts TO anon, authenticated;
GRANT SELECT ON TABLE public.equipments TO anon, authenticated;
GRANT SELECT ON TABLE public.court_reservations TO anon, authenticated;

-- 2. Register existing user into admin_members
INSERT INTO public.admin_members (user_id)
SELECT id FROM auth.users
WHERE email = 'nbhganzon@addu.edu.ph'
ON CONFLICT (user_id) DO NOTHING;
