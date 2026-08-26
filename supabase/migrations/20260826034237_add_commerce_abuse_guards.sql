CREATE TABLE private.commerce_throttles (
  actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('checkout_order', 'receipt_upload')),
  window_started_at TIMESTAMPTZ NOT NULL,
  attempt_count BIGINT NOT NULL CHECK (attempt_count > 0),
  PRIMARY KEY (actor_id, action)
);

REVOKE ALL ON TABLE private.commerce_throttles FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.consume_commerce_throttle(
  p_actor_id UUID,
  p_action TEXT,
  p_limit BIGINT,
  p_window INTERVAL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
  v_count BIGINT;
BEGIN
  IF p_actor_id IS NULL OR p_action NOT IN ('checkout_order', 'receipt_upload')
     OR p_limit <= 0 OR p_window <= INTERVAL '0 seconds'
     OR NOT EXISTS (SELECT 1 FROM auth.users AS u WHERE u.id = p_actor_id) THEN
    RAISE EXCEPTION 'invalid commerce throttle input' USING ERRCODE = '22023';
  END IF;

  INSERT INTO private.commerce_throttles (actor_id, action, window_started_at, attempt_count)
  VALUES (p_actor_id, p_action, v_now, 1)
  ON CONFLICT (actor_id, action) DO UPDATE
  SET window_started_at = CASE
        WHEN private.commerce_throttles.window_started_at <= v_now - p_window THEN v_now
        ELSE private.commerce_throttles.window_started_at
      END,
      attempt_count = CASE
        WHEN private.commerce_throttles.window_started_at <= v_now - p_window THEN 1
        ELSE private.commerce_throttles.attempt_count + 1
      END
  RETURNING attempt_count INTO v_count;

  RETURN v_count <= p_limit;
END;
$$;

ALTER FUNCTION private.consume_commerce_throttle(UUID, TEXT, BIGINT, INTERVAL) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.consume_commerce_throttle(UUID, TEXT, BIGINT, INTERVAL) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.allow_checkout_attempt(p_idempotency_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL OR p_idempotency_key IS NULL
     OR pg_catalog.btrim(p_idempotency_key) = ''
     OR pg_catalog.length(p_idempotency_key) > 128 THEN
    RAISE EXCEPTION 'invalid checkout throttle input' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.orders AS o
    WHERE o.user_id = v_actor AND o.idempotency_key = p_idempotency_key
  ) THEN
    RETURN true;
  END IF;

  RETURN private.consume_commerce_throttle(v_actor, 'checkout_order', 5, INTERVAL '10 minutes');
END;
$$;

ALTER FUNCTION public.allow_checkout_attempt(TEXT) OWNER TO postgres;

CREATE FUNCTION public.allow_receipt_upload_attempt(p_payment_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL OR p_payment_id IS NULL THEN
    RAISE EXCEPTION 'invalid receipt throttle input' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.payments AS p
    JOIN public.orders AS o ON o.id = p.order_id
    WHERE p.id = p_payment_id
      AND p.method = 'MANUAL_GCASH'
      AND p.status IN ('UNPAID', 'REJECTED')
      AND o.user_id = v_actor
      AND o.status = 'CONFIRMED'
  ) THEN
    RETURN false;
  END IF;

  RETURN private.consume_commerce_throttle(v_actor, 'receipt_upload', 5, INTERVAL '15 minutes');
END;
$$;

ALTER FUNCTION public.allow_receipt_upload_attempt(UUID) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.allow_checkout_attempt(TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.allow_receipt_upload_attempt(UUID) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.allow_checkout_attempt(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.allow_receipt_upload_attempt(UUID) TO authenticated;
