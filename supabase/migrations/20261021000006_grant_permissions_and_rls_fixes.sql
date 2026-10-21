-- Migration 6: Table Permissions and RLS Fixes
-- Grants appropriate table access to service_role, authenticated, and anon roles,
-- and ensures RLS policies allow authenticated users to check admin status and access their cards.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Grant service_role full administrative access across all public tables, sequences, and routines
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

-- Grant authenticated role access required for RLS-filtered operations
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.courts,
  public.equipments,
  public.court_reservations,
  public.equipment_rentals,
  public.membership_cards,
  public.transactions,
  public.topups,
  public.admin_members
TO authenticated;

-- Grant public read access to catalog tables
GRANT SELECT ON TABLE
  public.courts,
  public.equipments,
  public.court_reservations
TO anon;

-- Set default privileges for future tables created in public schema
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON ROUTINES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

-- Ensure equipment_rentals has an RLS policy for user read
ALTER TABLE public.equipment_rentals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "User read own equipment rentals" ON public.equipment_rentals;
CREATE POLICY "User read own equipment rentals" ON public.equipment_rentals
  FOR SELECT TO authenticated
  USING (
    transaction_id IN (
      SELECT t.id FROM public.transactions t
      JOIN public.membership_cards mc ON mc.id = t.card_id
      WHERE mc.user_id = auth.uid()
    )
    OR public.is_admin()
  );

-- Ensure admin_members has proper RLS policy for admin check
DROP POLICY IF EXISTS "Admin members self check" ON public.admin_members;
CREATE POLICY "Admin members self check" ON public.admin_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
