-- Harden the canonical POS boundary without changing sale, inventory, payment,
-- or idempotency behavior. The public wrapper owns register authorization and
-- holds the register row lock until the delegated sale transaction completes.

ALTER FUNCTION public.create_pos_sale(JSONB, TEXT, BIGINT, TEXT, TEXT, TEXT, UUID, TEXT)
  SET SCHEMA private;

REVOKE ALL ON FUNCTION private.create_pos_sale(JSONB, TEXT, BIGINT, TEXT, TEXT, TEXT, UUID, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.create_pos_sale(
  p_items JSONB,
  p_payment_method TEXT,
  p_tendered_minor BIGINT,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_customer_email TEXT DEFAULT 'pos.walkin@1968.local',
  p_register_session_id UUID DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_session public.register_sessions%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '42501';
  END IF;

  IF coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' THEN
    RAISE EXCEPTION 'AAL2 required for POS sale' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    private.has_role('cashier')
    OR private.has_role('admin')
    OR private.has_role('super_admin')
  ) THEN
    RAISE EXCEPTION 'insufficient role for POS sale' USING ERRCODE = '42501';
  END IF;

  IF p_register_session_id IS NULL THEN
    RAISE EXCEPTION 'POS_REGISTER_SESSION_REQUIRED' USING ERRCODE = '22004';
  END IF;

  SELECT rs.*
  INTO v_session
  FROM public.register_sessions AS rs
  WHERE rs.id = p_register_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POS_REGISTER_SESSION_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_session.cashier_id <> v_actor THEN
    RAISE EXCEPTION 'POS_REGISTER_SESSION_NOT_OWNED' USING ERRCODE = '42501';
  END IF;

  IF v_session.status <> 'OPEN' THEN
    RAISE EXCEPTION 'POS_REGISTER_SESSION_CLOSED' USING ERRCODE = '55000';
  END IF;

  RETURN private.create_pos_sale(
    p_items,
    p_payment_method,
    p_tendered_minor,
    p_customer_name,
    p_customer_phone,
    p_customer_email,
    p_register_session_id,
    p_idempotency_key
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_pos_sale(JSONB, TEXT, BIGINT, TEXT, TEXT, TEXT, UUID, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_pos_sale(JSONB, TEXT, BIGINT, TEXT, TEXT, TEXT, UUID, TEXT)
  TO authenticated;

COMMENT ON FUNCTION public.create_pos_sale(JSONB, TEXT, BIGINT, TEXT, TEXT, TEXT, UUID, TEXT)
  IS 'AAL2 POS sale boundary requiring an owned OPEN register session locked for the transaction.';
