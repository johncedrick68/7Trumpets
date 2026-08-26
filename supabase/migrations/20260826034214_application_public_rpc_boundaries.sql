-- Expose only authenticated, current-user operations while keeping private tables and
-- canonical commerce functions outside the Data API.
CREATE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT ur.role
  FROM private.user_roles AS ur
  WHERE ur.user_id = auth.uid()
  ORDER BY CASE ur.role
    WHEN 'super_admin' THEN 1
    WHEN 'admin' THEN 2
    ELSE 3
  END
  LIMIT 1
$$;

ALTER FUNCTION public.current_user_role() OWNER TO postgres;

CREATE FUNCTION public.list_staff_roles()
RETURNS TABLE (user_id UUID, role TEXT, assigned_by UUID, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR coalesce(auth.jwt() ->> 'aal', '') <> 'aal2'
     OR NOT private.has_role('super_admin') THEN
    RAISE EXCEPTION 'super_admin AAL2 required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT ur.user_id, ur.role, ur.assigned_by, ur.created_at
  FROM private.user_roles AS ur
  WHERE ur.role IN ('admin', 'super_admin')
  ORDER BY ur.created_at DESC, ur.user_id, ur.role;
END;
$$;

ALTER FUNCTION public.list_staff_roles() OWNER TO postgres;

CREATE FUNCTION public.submit_gcash_proof(
  p_payment_id UUID,
  p_claimed_amount_minor BIGINT,
  p_receipt_storage_path TEXT,
  p_reservation_expires_at TIMESTAMPTZ,
  p_submission_idempotency_key TEXT,
  p_event_idempotency_key TEXT,
  p_reference_number TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  RETURN private.submit_gcash_proof(
    p_payment_id, v_actor, p_claimed_amount_minor, p_reference_number,
    p_receipt_storage_path, p_reservation_expires_at,
    p_submission_idempotency_key, p_event_idempotency_key
  );
END;
$$;

ALTER FUNCTION public.submit_gcash_proof(UUID, BIGINT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT)
OWNER TO postgres;

CREATE FUNCTION public.approve_gcash_submission(
  p_payment_id UUID,
  p_submission_id UUID,
  p_idempotency_key TEXT,
  p_reason TEXT DEFAULT NULL
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

  RETURN private.approve_gcash_submission(
    p_payment_id, p_submission_id, v_actor, p_idempotency_key, p_reason
  );
END;
$$;

ALTER FUNCTION public.approve_gcash_submission(UUID, UUID, TEXT, TEXT) OWNER TO postgres;

CREATE FUNCTION public.reject_gcash_submission(
  p_payment_id UUID,
  p_submission_id UUID,
  p_rejection_reason TEXT,
  p_idempotency_key TEXT
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

  RETURN private.reject_gcash_submission(
    p_payment_id, p_submission_id, v_actor, p_rejection_reason, p_idempotency_key
  );
END;
$$;

ALTER FUNCTION public.reject_gcash_submission(UUID, UUID, TEXT, TEXT) OWNER TO postgres;

CREATE FUNCTION public.settle_cod_payment(
  p_payment_id UUID,
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
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL OR coalesce(auth.jwt() ->> 'aal', '') <> 'aal2'
     OR NOT (private.has_role('admin') OR private.has_role('super_admin')) THEN
    RAISE EXCEPTION 'admin AAL2 required' USING ERRCODE = '42501';
  END IF;

  RETURN private.settle_cod_payment(
    p_payment_id, v_actor, p_reason, p_idempotency_key, p_metadata
  );
END;
$$;

ALTER FUNCTION public.settle_cod_payment(UUID, TEXT, TEXT, JSONB) OWNER TO postgres;

CREATE FUNCTION public.admin_transition_order(
  p_order_id UUID,
  p_to_status TEXT,
  p_note TEXT,
  p_source TEXT,
  p_idempotency_key TEXT,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS public.orders
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

  RETURN public.transition_order(
    p_order_id, p_to_status, p_note, p_source, v_actor, p_idempotency_key, p_metadata
  );
END;
$$;

ALTER FUNCTION public.admin_transition_order(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) OWNER TO postgres;

CREATE FUNCTION public.authorize_payment_receipt_preview(p_submission_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_role TEXT;
  v_path TEXT;
BEGIN
  IF v_actor IS NULL OR coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' THEN
    RAISE EXCEPTION 'admin AAL2 required' USING ERRCODE = '42501';
  END IF;

  SELECT ur.role INTO v_role
  FROM private.user_roles AS ur
  WHERE ur.user_id = v_actor AND ur.role IN ('admin', 'super_admin')
  ORDER BY CASE ur.role WHEN 'super_admin' THEN 1 ELSE 2 END
  LIMIT 1;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'admin AAL2 required' USING ERRCODE = '42501';
  END IF;

  SELECT s.receipt_storage_path INTO v_path
  FROM public.payment_submissions AS s
  WHERE s.id = p_submission_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment submission not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.audit_logs (actor_id, actor_role, action, entity, entity_id)
  VALUES (v_actor, v_role, 'payment.receipt_preview_authorized', 'payment_submission', p_submission_id);

  RETURN v_path;
END;
$$;

ALTER FUNCTION public.authorize_payment_receipt_preview(UUID) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.list_staff_roles() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.submit_gcash_proof(UUID, BIGINT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.approve_gcash_submission(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.reject_gcash_submission(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.settle_cod_payment(UUID, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_transition_order(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.authorize_payment_receipt_preview(UUID) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_staff_roles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_gcash_proof(UUID, BIGINT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_gcash_submission(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_gcash_submission(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.settle_cod_payment(UUID, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_transition_order(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.authorize_payment_receipt_preview(UUID) TO authenticated;

-- Authenticated upload lets Storage assign owner_id from the verified JWT. Reads
-- remain signed-URL-only and cleanup remains a trusted server operation.
CREATE POLICY payment_receipts_owner_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'payment-receipts'
  AND name ~ (
    '^' || auth.uid()::TEXT
    || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
    || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
    || '\.(jpg|png|webp)$'
  )
  AND EXISTS (
    SELECT 1
    FROM public.orders AS o
    WHERE o.id = ((storage.foldername(name))[2])::UUID
      AND o.user_id = auth.uid()
      AND o.status = 'CONFIRMED'
  )
);

-- Data API callers must use the authenticated public wrappers.
REVOKE EXECUTE ON FUNCTION private.settle_cod_payment(UUID, UUID, TEXT, TEXT, JSONB) FROM service_role;
REVOKE EXECUTE ON FUNCTION private.submit_gcash_proof(UUID, UUID, BIGINT, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT) FROM service_role;
REVOKE EXECUTE ON FUNCTION private.approve_gcash_submission(UUID, UUID, UUID, TEXT, TEXT) FROM service_role;
REVOKE EXECUTE ON FUNCTION private.reject_gcash_submission(UUID, UUID, UUID, TEXT, TEXT) FROM service_role;
REVOKE EXECUTE ON FUNCTION public.transition_order(UUID, TEXT, TEXT, TEXT, UUID, TEXT, JSONB) FROM service_role;
