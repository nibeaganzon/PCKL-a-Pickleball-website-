-- Migration 2: Auth and Triggers
-- Automates membership card provisioning on user signup with retry handling.

-- 1. Helper function to generate PICKL- + 16 alphanumeric characters
CREATE OR REPLACE FUNCTION public.generate_card_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  result text := 'PICKL-';
  i integer;
BEGIN
  FOR i IN 1..16 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- 2. Trigger function to provision active membership card for new auth users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_card_number text;
  retries integer := 0;
  card_created boolean := false;
BEGIN
  WHILE NOT card_created AND retries < 3 LOOP
    BEGIN
      new_card_number := public.generate_card_number();
      INSERT INTO public.membership_cards (
        user_id,
        card_number,
        balance,
        status,
        issued_at
      ) VALUES (
        NEW.id,
        new_card_number,
        0,
        'Active',
        now()
      );
      card_created := true;
    EXCEPTION
      WHEN unique_violation THEN
        retries := retries + 1;
    END;
  END LOOP;

  IF NOT card_created THEN
    RAISE EXCEPTION 'Failed to generate unique membership card number after retries.';
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Attach trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 4. Backfill any existing auth users who lack an active membership card
DO $$
DECLARE
  user_rec RECORD;
  generated_num text;
BEGIN
  FOR user_rec IN
    SELECT u.id
    FROM auth.users u
    LEFT JOIN public.membership_cards mc ON mc.user_id = u.id AND mc.status = 'Active'
    WHERE mc.id IS NULL
  LOOP
    generated_num := public.generate_card_number();
    INSERT INTO public.membership_cards (user_id, card_number, balance, status, issued_at)
    VALUES (user_rec.id, generated_num, 0, 'Active', now())
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
