-- Restore the paid-before-completion invariant omitted when the order
-- transition graph was expanded for pickup and POS fulfillment.
CREATE OR REPLACE FUNCTION private.validate_order_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  payment_method text;
  payment_status text;
BEGIN
  IF new.status = old.status THEN
    RETURN new;
  END IF;

  IF (old.status, new.status) NOT IN (
    ('CONFIRMED', 'PROCESSING'),
    ('CONFIRMED', 'CANCELLED'),
    ('PROCESSING', 'PACKING'),
    ('PROCESSING', 'READY_FOR_SHIPMENT'),
    ('PROCESSING', 'DELIVERED'),
    ('PROCESSING', 'CANCELLED'),
    ('PACKING', 'READY_FOR_SHIPMENT'),
    ('PACKING', 'CANCELLED'),
    ('READY_FOR_SHIPMENT', 'SHIPPED'),
    ('READY_FOR_SHIPMENT', 'DELIVERED'),
    ('READY_FOR_SHIPMENT', 'CANCELLED'),
    ('SHIPPED', 'IN_TRANSIT'),
    ('SHIPPED', 'OUT_FOR_DELIVERY'),
    ('SHIPPED', 'DELIVERY_FAILED'),
    ('IN_TRANSIT', 'OUT_FOR_DELIVERY'),
    ('IN_TRANSIT', 'DELIVERY_FAILED'),
    ('OUT_FOR_DELIVERY', 'DELIVERED'),
    ('OUT_FOR_DELIVERY', 'DELIVERY_FAILED'),
    ('DELIVERED', 'COMPLETED'),
    ('DELIVERY_FAILED', 'IN_TRANSIT'),
    ('DELIVERY_FAILED', 'OUT_FOR_DELIVERY'),
    ('DELIVERY_FAILED', 'CANCELLED')
  ) THEN
    RAISE EXCEPTION 'invalid order transition: % -> %', old.status, new.status
      USING errcode = '23514';
  END IF;

  IF old.status = 'CONFIRMED' AND new.status = 'PROCESSING' THEN
    SELECT p.method, p.status
    INTO payment_method, payment_status
    FROM public.payments AS p
    WHERE p.order_id = new.id;

    IF payment_method IS NULL
       OR (payment_method = 'MANUAL_GCASH' AND payment_status <> 'PAID')
       OR (payment_method = 'COD' AND payment_status NOT IN ('UNPAID', 'PAID'))
       OR (payment_method = 'CASH' AND payment_status NOT IN ('UNPAID', 'PAID')) THEN
      RAISE EXCEPTION 'payment is not eligible for order processing'
        USING errcode = '23514';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.inventory_reservations AS r
      WHERE r.order_id = new.id
    ) OR EXISTS (
      SELECT 1 FROM public.inventory_reservations AS r
      WHERE r.order_id = new.id AND r.status <> 'consumed'
    ) THEN
      RAISE EXCEPTION 'all order reservations must be consumed before processing'
        USING errcode = '23514';
    END IF;
  END IF;

  IF old.status = 'DELIVERED' AND new.status = 'COMPLETED' THEN
    SELECT p.status
    INTO payment_status
    FROM public.payments AS p
    WHERE p.order_id = new.id;

    IF payment_status IS NULL OR payment_status <> 'PAID' THEN
      RAISE EXCEPTION 'completed order requires paid payment'
        USING errcode = '23514';
    END IF;
  END IF;

  RETURN new;
END;
$$;

ALTER FUNCTION private.validate_order_transition() OWNER TO postgres;
REVOKE ALL ON FUNCTION private.validate_order_transition()
  FROM PUBLIC, anon, authenticated, service_role;
