-- Migration 7: Fix operator precedence in charge_membership_card RPC
-- PostgreSQL || operator has higher precedence than ->>, causing text ->> unknown syntax errors.
-- Explicit parentheses around (v_item->>'date') and (v_item->>'startTime'), plus interval-based end calculation.

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
