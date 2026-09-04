-- Expose authenticated AAL2 admin expiration RPC and database eligibility listing.

CREATE FUNCTION public.close_expired_gcash_payment(
  p_payment_id UUID,
  p_idempotency_key TEXT,
  p_reason TEXT DEFAULT 'Payment window expired without verified receipt'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL OR coalesce(auth.jwt() ->> 'aal', '') <> 'aal2'
     OR NOT (private.has_role('admin') OR private.has_role('super_admin')) THEN
    RAISE EXCEPTION 'admin AAL2 required' USING ERRCODE = '42501';
  END IF;

  IF p_payment_id IS NULL THEN
    RAISE EXCEPTION 'invalid GCash timeout closure input' USING ERRCODE = '22023';
  END IF;

  IF p_reason IS NULL OR pg_catalog.btrim(p_reason, E' \t\n\r') = '' THEN
    RAISE EXCEPTION 'invalid GCash timeout closure input' USING ERRCODE = '22023';
  END IF;

  RETURN private.close_expired_gcash_payment(
    p_payment_id, v_actor, p_reason, p_idempotency_key
  );
END;
$$;

ALTER FUNCTION public.close_expired_gcash_payment(UUID, TEXT, TEXT) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.close_expired_gcash_payment(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.close_expired_gcash_payment(UUID, TEXT, TEXT) TO authenticated;

CREATE FUNCTION public.list_expired_gcash_payments()
RETURNS TABLE (
  payment_id UUID,
  order_id UUID,
  order_number TEXT,
  customer_email TEXT,
  recipient_name TEXT,
  amount_minor BIGINT,
  payment_status TEXT,
  reservation_expires_at TIMESTAMPTZ,
  active_reservation_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR coalesce(auth.jwt() ->> 'aal', '') <> 'aal2'
     OR NOT (private.has_role('admin') OR private.has_role('super_admin')) THEN
    RAISE EXCEPTION 'admin AAL2 required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    p.id AS payment_id,
    o.id AS order_id,
    o.order_number,
    o.customer_email,
    o.recipient_name,
    p.amount_minor,
    p.status AS payment_status,
    min(r.expires_at) AS reservation_expires_at,
    count(r.id) AS active_reservation_count
  FROM public.payments AS p
  JOIN public.orders AS o ON o.id = p.order_id
  JOIN public.inventory_reservations AS r ON r.order_id = o.id
  WHERE p.method = 'MANUAL_GCASH'
    AND o.status = 'CONFIRMED'
    AND p.status IN ('UNPAID', 'REJECTED')
    AND r.status = 'active'
    AND (
      (p.status = 'UNPAID' AND NOT EXISTS (
        SELECT 1 FROM public.payment_submissions AS s WHERE s.payment_id = p.id
      ))
      OR
      (p.status = 'REJECTED' AND (
        SELECT s.review_status FROM public.payment_submissions AS s
        WHERE s.payment_id = p.id
        ORDER BY s.created_at DESC, s.id DESC LIMIT 1
      ) = 'REJECTED')
    )
  GROUP BY p.id, o.id, o.order_number, o.customer_email, o.recipient_name, p.amount_minor, p.status
  HAVING max(r.expires_at) <= pg_catalog.now()
  ORDER BY min(r.expires_at) ASC;
END;
$$;

ALTER FUNCTION public.list_expired_gcash_payments() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.list_expired_gcash_payments() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_expired_gcash_payments() TO authenticated;
