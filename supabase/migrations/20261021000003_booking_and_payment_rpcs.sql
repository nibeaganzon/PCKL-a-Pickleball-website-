-- Migration 3: Booking and Payment Stored Procedures
-- Implements atomic top-ups, checkout with pending reservation holds,
-- admin approval/rejection with automated balance refunds, and inventory CRUD helpers.

-- 1. Automatic Top-Up RPC
CREATE OR REPLACE FUNCTION public.automatic_topup(
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
  v_current_balance numeric(12,2);
  v_new_balance numeric(12,2);
  v_topup_id uuid;
  v_order_ref text;
  v_method public.payment_type;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: Top-up amount must be greater than zero.';
  END IF;

  SELECT id, balance INTO v_card_id, v_current_balance
  FROM public.membership_cards
  WHERE (id::text = p_card_id OR card_number = p_card_id)
    AND status = 'Active'
  LIMIT 1
  FOR UPDATE;

  IF v_card_id IS NULL THEN
    RAISE EXCEPTION 'CARD_NOT_FOUND: Active membership card was not found.';
  END IF;

  v_method := CASE
    WHEN lower(p_payment_method) = 'cash' THEN 'Cash'::public.payment_type
    ELSE 'Online'::public.payment_type
  END;

  v_order_ref := 'TOP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16));

  UPDATE public.membership_cards
  SET balance = balance + p_amount
  WHERE id = v_card_id
  RETURNING balance INTO v_new_balance;

  INSERT INTO public.topups (
    card_id,
    amount,
    payment_method,
    order_reference,
    proof_path,
    topup_date
  ) VALUES (
    v_card_id,
    p_amount,
    v_method,
    v_order_ref,
    p_proof_path,
    now()
  ) RETURNING id INTO v_topup_id;

  RETURN jsonb_build_object(
    'topup_id', v_topup_id,
    'order_reference', v_order_ref,
    'balance_after', v_new_balance
  );
END;
$$;

-- 2. Charge Membership Card & Create Pending Booking
CREATE OR REPLACE FUNCTION public.charge_membership_card(
  p_card_id text,
  p_cart jsonb,
  p_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card_id uuid;
  v_current_balance numeric(12,2);
  v_new_balance numeric(12,2);
  v_transaction_id uuid;
  v_order_reference text;
  v_item jsonb;
  v_court_id uuid;
  v_equip_id uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_duration int;
  v_quantity int;
  v_unit_price numeric(12,2);
  v_item_type text;
BEGIN
  IF p_amount <= 0 OR jsonb_array_length(p_cart) = 0 THEN
    RAISE EXCEPTION 'INVALID_CART: Cart must have valid items and positive total amount.';
  END IF;

  SELECT id, balance INTO v_card_id, v_current_balance
  FROM public.membership_cards
  WHERE (id::text = p_card_id OR card_number = p_card_id)
    AND status = 'Active'
  LIMIT 1
  FOR UPDATE;

  IF v_card_id IS NULL THEN
    RAISE EXCEPTION 'CARD_NOT_FOUND: Active membership card not found.';
  END IF;

  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: Available balance is less than total amount.';
  END IF;

  -- Deduct balance
  UPDATE public.membership_cards
  SET balance = balance - p_amount
  WHERE id = v_card_id
  RETURNING balance INTO v_new_balance;

  -- Create checkout transaction
  v_order_reference := 'PAY-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 20));

  INSERT INTO public.transactions (
    card_id,
    total_amount,
    transaction_type,
    status,
    order_reference,
    transaction_date
  ) VALUES (
    v_card_id,
    p_amount,
    'Checkout',
    'Pending',
    v_order_reference,
    now()
  ) RETURNING id INTO v_transaction_id;

  -- Iterate through cart items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_cart)
  LOOP
    v_item_type := v_item->>'type';
    v_duration := COALESCE((v_item->>'durationHours')::int, 1);
    v_quantity := COALESCE((v_item->>'quantity')::int, 1);
    v_unit_price := COALESCE((v_item->>'unitPrice')::numeric, 0);

    IF v_item_type = 'court' THEN
      -- Resolve court by UUID or court name
      SELECT id INTO v_court_id
      FROM public.courts
      WHERE id::text = (v_item->>'id')
         OR name = (v_item->>'name')
      LIMIT 1;

      IF v_court_id IS NULL THEN
        RAISE EXCEPTION 'COURT_NOT_FOUND: Court % was not found.', (v_item->>'name');
      END IF;

      v_start := ((v_item->>'date') || ' ' || (v_item->>'startTime') || ':00+08')::timestamptz;
      v_end := v_start + (v_duration || ' hours')::interval;

      INSERT INTO public.court_reservations (
        transaction_id,
        court_id,
        start_date,
        end_date,
        amount,
        status
      ) VALUES (
        v_transaction_id,
        v_court_id,
        v_start,
        v_end,
        v_unit_price * v_duration * v_quantity,
        'Pending'
      );

    ELSIF v_item_type = 'equipment' THEN
      SELECT id INTO v_equip_id
      FROM public.equipments
      WHERE id::text = (v_item->>'id')
         OR lower(name) LIKE '%' || lower(v_item->>'id') || '%'
         OR name = (v_item->>'name')
      LIMIT 1;

      IF v_equip_id IS NULL THEN
        RAISE EXCEPTION 'EQUIPMENT_NOT_FOUND: Equipment % was not found.', (v_item->>'name');
      END IF;

      INSERT INTO public.equipment_rentals (
        transaction_id,
        equipment_id,
        start_date,
        end_date,
        quantity,
        unit_price,
        status
      ) VALUES (
        v_transaction_id,
        v_equip_id,
        now(),
        now() + (v_duration || ' hours')::interval,
        v_quantity,
        v_unit_price,
        'Pending'
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'order_reference', v_order_reference,
    'transaction_id', v_transaction_id,
    'balance_after', v_new_balance
  );
END;
$$;

-- 3. Review Payment / Booking (Approve or Reject with Refund)
CREATE OR REPLACE FUNCTION public.review_payment(
  p_payment_id text,
  p_status text,
  p_reviewed_by uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trans record;
BEGIN
  IF p_status NOT IN ('confirmed', 'rejected') THEN
    RAISE EXCEPTION 'INVALID_STATUS: Status must be confirmed or rejected.';
  END IF;

  SELECT * INTO v_trans
  FROM public.transactions
  WHERE id::text = p_payment_id OR order_reference = p_payment_id
  FOR UPDATE;

  IF v_trans.id IS NULL THEN
    RAISE EXCEPTION 'PAYMENT_NOT_FOUND: Transaction was not found.';
  END IF;

  IF v_trans.status <> 'Pending' THEN
    RAISE EXCEPTION 'PAYMENT_ALREADY_REVIEWED: Transaction has already been reviewed.';
  END IF;

  IF p_status = 'confirmed' THEN
    UPDATE public.transactions
    SET status = 'Confirmed',
        reviewed_at = now(),
        reviewed_by = p_reviewed_by
    WHERE id = v_trans.id;

    UPDATE public.court_reservations
    SET status = 'Active'
    WHERE transaction_id = v_trans.id AND status = 'Pending';

    UPDATE public.equipment_rentals
    SET status = 'Active'
    WHERE transaction_id = v_trans.id AND status = 'Pending';

  ELSIF p_status = 'rejected' THEN
    UPDATE public.transactions
    SET status = 'Rejected',
        reviewed_at = now(),
        reviewed_by = p_reviewed_by
    WHERE id = v_trans.id;

    UPDATE public.court_reservations
    SET status = 'Cancelled'
    WHERE transaction_id = v_trans.id AND status = 'Pending';

    UPDATE public.equipment_rentals
    SET status = 'Cancelled'
    WHERE transaction_id = v_trans.id AND status = 'Pending';

    -- Automated refund of balance
    UPDATE public.membership_cards
    SET balance = balance + v_trans.total_amount
    WHERE id = v_trans.card_id;
  END IF;

  RETURN jsonb_build_object(
    'id', v_trans.id,
    'order_reference', v_trans.order_reference,
    'status', p_status,
    'reviewed_at', now()
  );
END;
$$;

-- 4. Admin Inventory CRUD Functions
CREATE OR REPLACE FUNCTION public.admin_create_court(
  p_name text,
  p_type text,
  p_price numeric,
  p_description text DEFAULT NULL,
  p_images text[] DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_court_id uuid;
  v_type public.court_type;
BEGIN
  v_type := CASE WHEN lower(p_type) = 'outdoor' THEN 'Outdoor'::public.court_type ELSE 'Indoor'::public.court_type END;

  INSERT INTO public.courts (name, type, price, description, images, is_active)
  VALUES (p_name, v_type, p_price, p_description, p_images, true)
  RETURNING id INTO v_court_id;

  RETURN v_court_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_court(
  p_id uuid,
  p_name text,
  p_type text,
  p_price numeric,
  p_description text DEFAULT NULL,
  p_is_active boolean DEFAULT true,
  p_images text[] DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type public.court_type;
BEGIN
  v_type := CASE WHEN lower(p_type) = 'outdoor' THEN 'Outdoor'::public.court_type ELSE 'Indoor'::public.court_type END;

  UPDATE public.courts
  SET name = p_name,
      type = v_type,
      price = p_price,
      description = p_description,
      is_active = p_is_active,
      images = COALESCE(p_images, images)
  WHERE id = p_id;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_court(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.courts WHERE id = p_id;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_equipment(
  p_name text,
  p_quantity bigint,
  p_price numeric,
  p_description text DEFAULT NULL,
  p_images text[] DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_equip_id uuid;
BEGIN
  INSERT INTO public.equipments (name, quantity, price, description, images)
  VALUES (p_name, p_quantity, p_price, p_description, p_images)
  RETURNING id INTO v_equip_id;

  RETURN v_equip_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_equipment(
  p_id uuid,
  p_name text,
  p_quantity bigint,
  p_price numeric,
  p_description text DEFAULT NULL,
  p_images text[] DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.equipments
  SET name = p_name,
      quantity = p_quantity,
      price = p_price,
      description = p_description,
      images = COALESCE(p_images, images)
  WHERE id = p_id;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_equipment(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.equipments WHERE id = p_id;
  RETURN FOUND;
END;
$$;
