-- Migration 4: Row Level Security and Seed Data
-- Configures RLS policies across domain tables and seeds the 20 courts and initial equipment items.

-- 1. Helper function to check admin membership
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_members
    WHERE user_id = auth.uid()
  );
$$;

-- 2. RLS Policies

-- Courts
DROP POLICY IF EXISTS "Courts read access" ON public.courts;
CREATE POLICY "Courts read access" ON public.courts
  FOR SELECT TO PUBLIC
  USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "Courts admin write" ON public.courts;
CREATE POLICY "Courts admin write" ON public.courts
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Equipments
DROP POLICY IF EXISTS "Equipments read access" ON public.equipments;
CREATE POLICY "Equipments read access" ON public.equipments
  FOR SELECT TO PUBLIC
  USING (true);

DROP POLICY IF EXISTS "Equipments admin write" ON public.equipments;
CREATE POLICY "Equipments admin write" ON public.equipments
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Membership Cards
DROP POLICY IF EXISTS "User read own cards" ON public.membership_cards;
CREATE POLICY "User read own cards" ON public.membership_cards
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- Transactions
DROP POLICY IF EXISTS "User read own transactions" ON public.transactions;
CREATE POLICY "User read own transactions" ON public.transactions
  FOR SELECT TO authenticated
  USING (
    card_id IN (SELECT id FROM public.membership_cards WHERE user_id = auth.uid())
    OR public.is_admin()
  );

-- Top-ups
DROP POLICY IF EXISTS "User read own topups" ON public.topups;
CREATE POLICY "User read own topups" ON public.topups
  FOR SELECT TO authenticated
  USING (
    card_id IN (SELECT id FROM public.membership_cards WHERE user_id = auth.uid())
    OR public.is_admin()
  );

-- Court Reservations
DROP POLICY IF EXISTS "Public read court reservations" ON public.court_reservations;
CREATE POLICY "Public read court reservations" ON public.court_reservations
  FOR SELECT TO PUBLIC
  USING (true);

-- Admin Members
DROP POLICY IF EXISTS "Admin members self check" ON public.admin_members;
CREATE POLICY "Admin members self check" ON public.admin_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 3. Storage bucket for payment-proofs
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Seed Data: 20 Courts
DO $$
DECLARE
  i int;
  c_name text;
  c_type public.court_type;
  c_price numeric(12,2);
  c_img text;
  c_desc text;
BEGIN
  FOR i IN 1..20 LOOP
    c_name := 'Court ' || to_char(i, 'FM09');
    IF i IN (1, 2, 5, 7, 10, 12, 14, 16, 18, 20) THEN
      c_type := 'Indoor';
      c_price := 300.00;
      c_img := 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=900&q=85';
      c_desc := 'Indoor court with weather-protected play.';
    ELSE
      c_type := 'Outdoor';
      c_price := 250.00;
      c_img := 'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=900&q=85';
      c_desc := 'Open-air court for your next energetic game.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.courts WHERE name = c_name) THEN
      INSERT INTO public.courts (name, type, price, description, images, is_active)
      VALUES (c_name, c_type, c_price, c_desc, ARRAY[c_img], true);
    END IF;
  END LOOP;
END $$;

-- 5. Seed Data: Equipment
INSERT INTO public.equipments (name, quantity, price, description, images)
SELECT
  'Pickleball Paddle',
  20,
  50.00,
  'A paddle for practice sessions, casual rallies, and competitive games.',
  ARRAY['https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=900&q=85']
WHERE NOT EXISTS (SELECT 1 FROM public.equipments WHERE name = 'Pickleball Paddle');

INSERT INTO public.equipments (name, quantity, price, description, images)
SELECT
  'Pickleball Ball',
  20,
  10.00,
  'Rent pickleball balls for your session and return them after playing.',
  ARRAY['https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=900&q=85']
WHERE NOT EXISTS (SELECT 1 FROM public.equipments WHERE name = 'Pickleball Ball');
