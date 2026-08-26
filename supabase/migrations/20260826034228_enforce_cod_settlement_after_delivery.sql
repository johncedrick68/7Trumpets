CREATE OR REPLACE FUNCTION private.settle_cod_payment(
  p_payment_id UUID,
  p_actor_id UUID,
  p_reason TEXT,
  p_idempotency_key TEXT,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order_id UUID;
  v_order_status TEXT;
  v_payment public.payments%ROWTYPE;
BEGIN
  IF p_actor_id IS NULL THEN
    RAISE EXCEPTION 'invalid COD settlement input' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM private.user_roles AS ur
    WHERE ur.user_id = p_actor_id AND ur.role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'payment reviewer role required' USING ERRCODE = '42501';
  END IF;

  SELECT p.order_id INTO v_order_id
  FROM public.payments AS p
  WHERE p.id = p_payment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT o.status INTO v_order_status
  FROM public.orders AS o
  WHERE o.id = v_order_id
  FOR UPDATE;

  SELECT p.* INTO v_payment
  FROM public.payments AS p
  WHERE p.id = p_payment_id AND p.order_id = v_order_id
  FOR UPDATE;

  IF v_payment.method <> 'COD' THEN
    RAISE EXCEPTION 'payment is not COD' USING ERRCODE = 'P0001';
  END IF;
  IF v_order_status NOT IN ('DELIVERED', 'COMPLETED') THEN
    RAISE EXCEPTION 'COD settlement requires delivered order' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.inventory_reservations AS r WHERE r.order_id = v_order_id
  ) OR EXISTS (
    SELECT 1 FROM public.inventory_reservations AS r
    WHERE r.order_id = v_order_id AND r.status <> 'consumed'
  ) THEN
    RAISE EXCEPTION 'COD settlement requires consumed reservations' USING ERRCODE = 'P0001';
  END IF;

  RETURN private.transition_payment(
    p_payment_id, 'PAID', p_idempotency_key, p_actor_id, NULL, p_reason, p_metadata
  );
END;
$$;

ALTER FUNCTION private.settle_cod_payment(UUID, UUID, TEXT, TEXT, JSONB) OWNER TO postgres;

CREATE OR REPLACE FUNCTION private.validate_order_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  payment_method TEXT;
  payment_status TEXT;
BEGIN
  IF new.status = old.status THEN
    RETURN new;
  END IF;

  IF (old.status, new.status) NOT IN (
    ('CONFIRMED', 'PROCESSING'), ('CONFIRMED', 'CANCELLED'),
    ('PROCESSING', 'PACKING'), ('PROCESSING', 'READY_FOR_SHIPMENT'),
    ('PROCESSING', 'CANCELLED'), ('PACKING', 'READY_FOR_SHIPMENT'),
    ('PACKING', 'CANCELLED'), ('READY_FOR_SHIPMENT', 'SHIPPED'),
    ('READY_FOR_SHIPMENT', 'CANCELLED'), ('SHIPPED', 'IN_TRANSIT'),
    ('SHIPPED', 'OUT_FOR_DELIVERY'), ('SHIPPED', 'DELIVERY_FAILED'),
    ('IN_TRANSIT', 'OUT_FOR_DELIVERY'), ('IN_TRANSIT', 'DELIVERY_FAILED'),
    ('OUT_FOR_DELIVERY', 'DELIVERED'), ('OUT_FOR_DELIVERY', 'DELIVERY_FAILED'),
    ('DELIVERED', 'COMPLETED'), ('DELIVERY_FAILED', 'IN_TRANSIT'),
    ('DELIVERY_FAILED', 'OUT_FOR_DELIVERY'), ('DELIVERY_FAILED', 'CANCELLED')
  ) THEN
    RAISE EXCEPTION 'invalid order transition: % -> %', old.status, new.status
      USING ERRCODE = '23514';
  END IF;

  IF old.status = 'CONFIRMED' AND new.status = 'PROCESSING' THEN
    SELECT p.method, p.status INTO payment_method, payment_status
    FROM public.payments AS p WHERE p.order_id = new.id;

    IF payment_method IS NULL
       OR (payment_method = 'MANUAL_GCASH' AND payment_status <> 'PAID')
       OR (payment_method = 'COD' AND payment_status NOT IN ('UNPAID', 'PAID')) THEN
      RAISE EXCEPTION 'payment is not eligible for order processing' USING ERRCODE = '23514';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.inventory_reservations AS r WHERE r.order_id = new.id
    ) OR EXISTS (
      SELECT 1 FROM public.inventory_reservations AS r
      WHERE r.order_id = new.id AND r.status <> 'consumed'
    ) THEN
      RAISE EXCEPTION 'all order reservations must be consumed before processing' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF old.status = 'DELIVERED' AND new.status = 'COMPLETED' THEN
    SELECT p.status INTO payment_status
    FROM public.payments AS p WHERE p.order_id = new.id;

    IF payment_status IS NULL OR payment_status <> 'PAID' THEN
      RAISE EXCEPTION 'completed order requires paid payment' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN new;
END;
$$;

ALTER FUNCTION private.validate_order_transition() OWNER TO postgres;
REVOKE ALL ON FUNCTION private.validate_order_transition() FROM PUBLIC, anon, authenticated, service_role;
