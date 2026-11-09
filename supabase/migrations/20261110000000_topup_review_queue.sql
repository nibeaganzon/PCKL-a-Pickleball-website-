-- Migration: Top-Up Review Queue and Lifecycle
-- Adds status tracking to topups, sets up submit_topup and review_topup RPCs,
-- and backfills existing topups to Confirmed status.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE public.order_status AS ENUM ('Pending', 'Confirmed', 'Rejected');
  END IF;
END $$;

ALTER TABLE public.topups
  ADD COLUMN IF NOT EXISTS status public.order_status,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id);

UPDATE public.topups
SET status = 'Confirmed',
    reviewed_at = topup_date
WHERE status IS NULL;

ALTER TABLE public.topups
  ALTER COLUMN status SET DEFAULT 'Pending',
  ALTER COLUMN status SET NOT NULL;

CREATE OR REPLACE FUNCTION public.submit_topup(
  p_card_id text,
  p_amount numeric,
  p_payment_method text DEFAULT 'Online',
  p_proof_path text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card_id uuid;
  v_topup_id uuid;
  v_order_ref text;
  v_method public.payment_type;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: Top-up amount must be greater than zero.';
  END IF;

  SELECT id INTO v_card_id
  FROM public.membership_cards
  WHERE (id::text = p_card_id OR card_number = p_card_id)
    AND status = 'Active'
  LIMIT 1;

  IF v_card_id IS NULL THEN
    RAISE EXCEPTION 'CARD_NOT_FOUND: Active membership card was not found.';
  END IF;

  v_method := CASE
    WHEN lower(p_payment_method) = 'cash' THEN 'Cash'::public.payment_type
    ELSE 'Online'::public.payment_type
  END;

  v_order_ref := 'TOP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16));

  INSERT INTO public.topups (
    card_id,
    amount,
    payment_method,
    order_reference,
    proof_path,
    status,
    topup_date
  ) VALUES (
    v_card_id,
    p_amount,
    v_method,
    v_order_ref,
    p_proof_path,
    'Pending',
    now()
  ) RETURNING id INTO v_topup_id;

  RETURN jsonb_build_object(
    'topup_id', v_topup_id,
    'order_reference', v_order_ref,
    'status', 'Pending'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.review_topup(
  p_topup_id text,
  p_status text,
  p_reviewed_by uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_topup record;
  v_card_status text;
  v_new_balance numeric(12,2);
BEGIN
  IF p_status NOT IN ('confirmed', 'rejected') THEN
    RAISE EXCEPTION 'INVALID_STATUS: Status must be confirmed or rejected.';
  END IF;

  SELECT * INTO v_topup
  FROM public.topups
  WHERE id::text = p_topup_id OR order_reference = p_topup_id
  FOR UPDATE;

  IF v_topup.id IS NULL THEN
    RAISE EXCEPTION 'PAYMENT_NOT_FOUND: Top-up was not found.';
  END IF;

  IF v_topup.status <> 'Pending' THEN
    RAISE EXCEPTION 'PAYMENT_ALREADY_REVIEWED: Top-up has already been reviewed.';
  END IF;

  IF p_status = 'confirmed' THEN
    SELECT status::text INTO v_card_status
    FROM public.membership_cards
    WHERE id = v_topup.card_id
    FOR UPDATE;

    IF v_card_status IS NULL OR v_card_status <> 'Active' THEN
      RAISE EXCEPTION 'CARD_NOT_ACTIVE: Membership card is no longer active.';
    END IF;

    UPDATE public.membership_cards
    SET balance = balance + v_topup.amount
    WHERE id = v_topup.card_id
    RETURNING balance INTO v_new_balance;

    UPDATE public.topups
    SET status = 'Confirmed',
        reviewed_at = now(),
        reviewed_by = p_reviewed_by
    WHERE id = v_topup.id;

  ELSIF p_status = 'rejected' THEN
    UPDATE public.topups
    SET status = 'Rejected',
        reviewed_at = now(),
        reviewed_by = p_reviewed_by
    WHERE id = v_topup.id;
  END IF;

  RETURN jsonb_build_object(
    'id', v_topup.id,
    'order_reference', v_topup.order_reference,
    'status', p_status,
    'reviewed_at', now(),
    'balance_after', v_new_balance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_topup TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.review_topup TO authenticated, service_role;
