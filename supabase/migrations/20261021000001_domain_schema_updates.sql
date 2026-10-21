-- Migration 1: Domain Schema Updates
-- Adds court attributes, membership card identifiers,
-- single active card partial index, and admin registry.

-- 1. Add court_type enum and court attributes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'court_type') THEN
    CREATE TYPE public.court_type AS ENUM ('Indoor', 'Outdoor');
  END IF;
END $$;

ALTER TABLE public.courts
  ADD COLUMN IF NOT EXISTS type public.court_type NOT NULL DEFAULT 'Indoor',
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- 3. Update reservation default status
ALTER TABLE public.court_reservations
  ALTER COLUMN status SET DEFAULT 'Pending'::public.reservation_status;

ALTER TABLE public.equipment_rentals
  ALTER COLUMN status SET DEFAULT 'Pending'::public.reservation_status;

-- 4. Membership card identifier and single active card constraint
ALTER TABLE public.membership_cards
  ADD COLUMN IF NOT EXISTS card_number varchar(32);

CREATE UNIQUE INDEX IF NOT EXISTS membership_cards_card_number_key
  ON public.membership_cards (card_number);

-- Drop blanket 1-to-1 unique constraint to allow historical cards
ALTER TABLE public.membership_cards
  DROP CONSTRAINT IF EXISTS membership_cards_user_id_key;

-- Ensure each user can have at most one active membership card
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_user_card
  ON public.membership_cards (user_id)
  WHERE (status = 'Active');

-- 5. Top-up table adjustments
ALTER TABLE public.topups
  DROP COLUMN IF EXISTS processed_by_id,
  ADD COLUMN IF NOT EXISTS order_reference text UNIQUE,
  ADD COLUMN IF NOT EXISTS proof_path text;

-- 6. Transactions enhancements for order tracking and status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE public.order_status AS ENUM ('Pending', 'Confirmed', 'Rejected');
  END IF;
END $$;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS order_reference text UNIQUE,
  ADD COLUMN IF NOT EXISTS status public.order_status NOT NULL DEFAULT 'Pending',
  ADD COLUMN IF NOT EXISTS reviewed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id);

-- 7. Admin registry table
CREATE TABLE IF NOT EXISTS public.admin_members (
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT admin_members_pkey PRIMARY KEY (user_id),
  CONSTRAINT admin_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE public.admin_members ENABLE ROW LEVEL SECURITY;
