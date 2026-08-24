CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE RESTRICT,
  method TEXT NOT NULL CHECK (method IN ('COD', 'MANUAL_GCASH')),
  status TEXT NOT NULL DEFAULT 'UNPAID' CHECK (status IN (
    'UNPAID', 'SUBMITTED', 'VERIFYING', 'PAID', 'FAILED', 'REJECTED',
    'REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED'
  )),
  amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
  currency_code TEXT NOT NULL DEFAULT 'PHP' CHECK (currency_code ~ '^[A-Z]{3}$'),
  idempotency_key TEXT NOT NULL UNIQUE
    CHECK (pg_catalog.btrim(idempotency_key, E' \t\n\r') <> '' AND pg_catalog.length(idempotency_key) <= 128),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  CHECK (
    (status IN ('PAID', 'REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED') AND paid_at IS NOT NULL)
    OR (status NOT IN ('PAID', 'REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED') AND paid_at IS NULL)
  )
);

CREATE TABLE public.payment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
  submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_amount_minor BIGINT NOT NULL CHECK (claimed_amount_minor >= 0),
  reference_number TEXT CHECK (
    reference_number IS NULL OR (
      pg_catalog.btrim(reference_number, E' \t\n\r') <> ''
      AND pg_catalog.length(reference_number) <= 200
    )
  ),
  receipt_storage_path TEXT NOT NULL UNIQUE CHECK (
    pg_catalog.btrim(receipt_storage_path, E' \t\n\r') <> ''
    AND pg_catalog.length(receipt_storage_path) <= 1024
  ),
  review_status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (review_status IN ('PENDING', 'VERIFYING', 'APPROVED', 'REJECTED')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT CHECK (
    rejection_reason IS NULL OR (
      pg_catalog.btrim(rejection_reason, E' \t\n\r') <> ''
      AND pg_catalog.length(rejection_reason) <= 1000
    )
  ),
  idempotency_key TEXT NOT NULL CHECK (
    pg_catalog.btrim(idempotency_key, E' \t\n\r') <> ''
    AND pg_catalog.length(idempotency_key) <= 128
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  UNIQUE (payment_id, id),
  UNIQUE (payment_id, idempotency_key),
  CHECK (
    (review_status = 'PENDING' AND reviewed_by IS NULL AND reviewed_at IS NULL AND rejection_reason IS NULL)
    OR (review_status = 'VERIFYING' AND reviewed_by IS NOT NULL AND reviewed_at IS NULL AND rejection_reason IS NULL)
    OR (review_status = 'APPROVED' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND rejection_reason IS NULL)
    OR (review_status = 'REJECTED' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND rejection_reason IS NOT NULL)
  )
);

CREATE TABLE public.payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
  submission_id UUID,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'PAYMENT_CREATED', 'PROOF_SUBMITTED', 'REVIEW_STARTED', 'PAYMENT_PAID',
    'PAYMENT_FAILED', 'PROOF_REJECTED', 'PAYMENT_WINDOW_CLOSED'
  )),
  from_status TEXT CHECK (from_status IS NULL OR from_status IN (
    'UNPAID', 'SUBMITTED', 'VERIFYING', 'PAID', 'FAILED', 'REJECTED',
    'REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED'
  )),
  to_status TEXT NOT NULL CHECK (to_status IN (
    'UNPAID', 'SUBMITTED', 'VERIFYING', 'PAID', 'FAILED', 'REJECTED',
    'REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED'
  )),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT CHECK (reason IS NULL OR (pg_catalog.btrim(reason, E' \t\n\r') <> '' AND pg_catalog.length(reason) <= 1000)),
  idempotency_key TEXT NOT NULL CHECK (
    pg_catalog.btrim(idempotency_key, E' \t\n\r') <> ''
    AND pg_catalog.length(idempotency_key) <= 128
  ),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (
    pg_catalog.jsonb_typeof(metadata) = 'object' AND pg_catalog.pg_column_size(metadata) <= 16384
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  UNIQUE (payment_id, idempotency_key),
  FOREIGN KEY (payment_id, submission_id)
    REFERENCES public.payment_submissions(payment_id, id) ON DELETE RESTRICT
);

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role TEXT CHECK (actor_role IS NULL OR actor_role IN ('customer', 'admin', 'super_admin', 'service_role')),
  action TEXT NOT NULL CHECK (pg_catalog.btrim(action, E' \t\n\r') <> '' AND pg_catalog.length(action) <= 200),
  entity TEXT NOT NULL CHECK (pg_catalog.btrim(entity, E' \t\n\r') <> '' AND pg_catalog.length(entity) <= 100),
  entity_id UUID,
  old_values JSONB CHECK (
    old_values IS NULL OR (pg_catalog.jsonb_typeof(old_values) = 'object' AND pg_catalog.pg_column_size(old_values) <= 16384)
  ),
  new_values JSONB CHECK (
    new_values IS NULL OR (pg_catalog.jsonb_typeof(new_values) = 'object' AND pg_catalog.pg_column_size(new_values) <= 16384)
  ),
  request_id TEXT CHECK (request_id IS NULL OR pg_catalog.length(request_id) <= 200),
  ip_address INET,
  user_agent TEXT CHECK (user_agent IS NULL OR pg_catalog.length(user_agent) <= 1024),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (
    pg_catalog.jsonb_typeof(metadata) = 'object' AND pg_catalog.pg_column_size(metadata) <= 16384
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

CREATE INDEX payment_submissions_payment_created_idx
  ON public.payment_submissions (payment_id, created_at DESC);

CREATE INDEX payment_events_payment_created_idx
  ON public.payment_events (payment_id, created_at DESC);

CREATE INDEX audit_logs_entity_created_idx
  ON public.audit_logs (entity, entity_id, created_at DESC);

CREATE TRIGGER payments_set_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER payment_submissions_set_updated_at
BEFORE UPDATE ON public.payment_submissions
FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER payment_events_append_only
BEFORE UPDATE OR DELETE ON public.payment_events
FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();

CREATE TRIGGER audit_logs_append_only
BEFORE UPDATE OR DELETE ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();

CREATE FUNCTION private.enforce_payment_submission_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'payment submissions cannot be deleted' USING ERRCODE = '55000';
  END IF;

  IF NEW.payment_id IS DISTINCT FROM OLD.payment_id
     OR NEW.submitted_by IS DISTINCT FROM OLD.submitted_by
     OR NEW.claimed_amount_minor IS DISTINCT FROM OLD.claimed_amount_minor
     OR NEW.reference_number IS DISTINCT FROM OLD.reference_number
     OR NEW.receipt_storage_path IS DISTINCT FROM OLD.receipt_storage_path
     OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'payment submission evidence is immutable' USING ERRCODE = '55000';
  END IF;

  IF OLD.review_status IN ('APPROVED', 'REJECTED') AND (
       NEW.review_status IS DISTINCT FROM OLD.review_status
       OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
       OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
       OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
     ) THEN
    RAISE EXCEPTION 'terminal payment review is immutable' USING ERRCODE = '55000';
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION private.enforce_payment_submission_immutability() OWNER TO postgres;

CREATE TRIGGER payment_submissions_enforce_immutability
BEFORE UPDATE OR DELETE ON public.payment_submissions
FOR EACH ROW EXECUTE FUNCTION private.enforce_payment_submission_immutability();

CREATE FUNCTION private.validate_payment_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF (OLD.status, NEW.status) NOT IN (
    ('UNPAID', 'SUBMITTED'),
    ('UNPAID', 'PAID'),
    ('UNPAID', 'FAILED'),
    ('SUBMITTED', 'VERIFYING'),
    ('SUBMITTED', 'REJECTED'),
    ('SUBMITTED', 'FAILED'),
    ('VERIFYING', 'PAID'),
    ('VERIFYING', 'REJECTED'),
    ('VERIFYING', 'FAILED'),
    ('REJECTED', 'SUBMITTED')
  ) THEN
    RAISE EXCEPTION 'invalid payment transition: % -> %', OLD.status, NEW.status
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION private.validate_payment_transition() OWNER TO postgres;

CREATE TRIGGER payments_validate_transition
BEFORE UPDATE OF status ON public.payments
FOR EACH ROW EXECUTE FUNCTION private.validate_payment_transition();

CREATE FUNCTION private.record_initial_payment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status <> 'UNPAID' THEN
    RAISE EXCEPTION 'initial payment status must be UNPAID' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.payment_events (
    payment_id, event_type, from_status, to_status, idempotency_key
  ) VALUES (
    NEW.id, 'PAYMENT_CREATED', NULL, 'UNPAID', 'initial:' || NEW.id::TEXT
  );
  RETURN NEW;
END;
$$;

ALTER FUNCTION private.record_initial_payment_status() OWNER TO postgres;

CREATE TRIGGER payments_record_initial_status
AFTER INSERT ON public.payments
FOR EACH ROW EXECUTE FUNCTION private.record_initial_payment_status();

-- SECURITY DEFINER is required for later service_role-only payment state changes.
CREATE FUNCTION private.transition_payment(
  p_payment_id UUID,
  p_to_status TEXT,
  p_idempotency_key TEXT,
  p_actor_id UUID DEFAULT NULL,
  p_submission_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_event public.payment_events%ROWTYPE;
  v_submission public.payment_submissions%ROWTYPE;
  v_event_type TEXT;
BEGIN
  IF p_payment_id IS NULL OR p_to_status IS NULL
     OR p_to_status NOT IN ('VERIFYING', 'PAID', 'FAILED')
     OR p_idempotency_key IS NULL
     OR pg_catalog.btrim(p_idempotency_key, E' \t\n\r') = ''
     OR pg_catalog.length(p_idempotency_key) > 128
     OR (p_reason IS NOT NULL AND (
       pg_catalog.btrim(p_reason, E' \t\n\r') = '' OR pg_catalog.length(p_reason) > 1000
     ))
     OR p_metadata IS NULL OR pg_catalog.jsonb_typeof(p_metadata) <> 'object'
     OR pg_catalog.pg_column_size(p_metadata) > 16384 THEN
    RAISE EXCEPTION 'invalid payment transition input' USING ERRCODE = '22023';
  END IF;

  SELECT p.* INTO v_payment
  FROM public.payments AS p
  WHERE p.id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT e.* INTO v_event
  FROM public.payment_events AS e
  WHERE e.payment_id = p_payment_id AND e.idempotency_key = p_idempotency_key;

  IF FOUND THEN
    IF v_event.event_type = (CASE p_to_status
         WHEN 'VERIFYING' THEN 'REVIEW_STARTED'
         WHEN 'PAID' THEN 'PAYMENT_PAID'
         ELSE 'PAYMENT_FAILED'
       END)
       AND v_event.to_status = p_to_status
       AND v_event.submission_id IS NOT DISTINCT FROM p_submission_id
       AND v_event.actor_id IS NOT DISTINCT FROM p_actor_id
       AND v_event.reason IS NOT DISTINCT FROM p_reason
       AND v_event.metadata = p_metadata THEN
      RETURN v_event.to_status;
    END IF;
    RAISE EXCEPTION 'conflicting payment transition retry' USING ERRCODE = '23505';
  END IF;

  IF p_to_status = 'VERIFYING' THEN
    IF v_payment.method <> 'MANUAL_GCASH' OR v_payment.status <> 'SUBMITTED'
       OR p_submission_id IS NULL OR p_actor_id IS NULL THEN
      RAISE EXCEPTION 'invalid transition from % to VERIFYING', v_payment.status USING ERRCODE = 'P0001';
    END IF;
    SELECT s.* INTO v_submission
    FROM public.payment_submissions AS s
    WHERE s.id = p_submission_id AND s.payment_id = p_payment_id
    FOR UPDATE;
    IF NOT FOUND OR v_submission.review_status <> 'PENDING' THEN
      RAISE EXCEPTION 'submission is not pending review' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.payment_submissions
    SET review_status = 'VERIFYING', reviewed_by = p_actor_id
    WHERE id = p_submission_id;
    v_event_type := 'REVIEW_STARTED';
  ELSIF p_to_status = 'PAID' THEN
    IF v_payment.method <> 'COD' OR v_payment.status <> 'UNPAID' OR p_submission_id IS NOT NULL THEN
      RAISE EXCEPTION 'manual GCash approval requires approve_gcash_submission' USING ERRCODE = 'P0001';
    END IF;
    v_event_type := 'PAYMENT_PAID';
  ELSE
    IF v_payment.status NOT IN ('UNPAID', 'SUBMITTED', 'VERIFYING') THEN
      RAISE EXCEPTION 'invalid transition from % to FAILED', v_payment.status USING ERRCODE = 'P0001';
    END IF;
    v_event_type := 'PAYMENT_FAILED';
  END IF;

  UPDATE public.payments
  SET status = p_to_status,
      paid_at = CASE WHEN p_to_status = 'PAID' THEN pg_catalog.now() ELSE NULL END
  WHERE id = p_payment_id;

  INSERT INTO public.payment_events (
    payment_id, submission_id, event_type, from_status, to_status,
    actor_id, reason, idempotency_key, metadata
  ) VALUES (
    p_payment_id, p_submission_id, v_event_type, v_payment.status, p_to_status,
    p_actor_id, p_reason, p_idempotency_key, p_metadata
  );

  INSERT INTO public.audit_logs (actor_id, actor_role, action, entity, entity_id, old_values, new_values, metadata)
  VALUES (
    p_actor_id, NULL, 'payment.status_changed', 'payment', p_payment_id,
    pg_catalog.jsonb_build_object('status', v_payment.status),
    pg_catalog.jsonb_build_object('status', p_to_status), p_metadata
  );

  RETURN p_to_status;
END;
$$;

ALTER FUNCTION private.transition_payment(UUID, TEXT, TEXT, UUID, UUID, TEXT, JSONB) OWNER TO postgres;

-- SECURITY DEFINER exposes only the reviewer-authorized transition into VERIFYING.
CREATE FUNCTION private.start_gcash_review(
  p_payment_id UUID,
  p_submission_id UUID,
  p_reviewer_id UUID,
  p_idempotency_key TEXT,
  p_reason TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_reviewer_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM private.user_roles AS ur
    WHERE ur.user_id = p_reviewer_id AND ur.role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'payment reviewer role required' USING ERRCODE = '42501';
  END IF;

  RETURN private.transition_payment(
    p_payment_id, 'VERIFYING', p_idempotency_key, p_reviewer_id,
    p_submission_id, p_reason, p_metadata
  );
END;
$$;

ALTER FUNCTION private.start_gcash_review(UUID, UUID, UUID, TEXT, TEXT, JSONB) OWNER TO postgres;

-- SECURITY DEFINER exposes only the COD transition needed by trusted settlement.
CREATE FUNCTION private.settle_cod_payment(
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
  WHERE p.id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment not found' USING ERRCODE = 'P0002';
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

-- SECURITY DEFINER atomically records immutable proof and extends its stock hold.
CREATE FUNCTION private.submit_gcash_proof(
  p_payment_id UUID,
  p_submitted_by UUID,
  p_claimed_amount_minor BIGINT,
  p_reference_number TEXT,
  p_receipt_storage_path TEXT,
  p_reservation_expires_at TIMESTAMPTZ,
  p_submission_idempotency_key TEXT,
  p_event_idempotency_key TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_existing public.payment_submissions%ROWTYPE;
  v_existing_event public.payment_events%ROWTYPE;
  v_submission_id UUID;
  v_reservation_count INTEGER;
  v_receipt_metadata JSONB;
  v_receipt_owner_id TEXT;
BEGIN
  IF p_payment_id IS NULL OR p_submitted_by IS NULL
     OR p_claimed_amount_minor IS NULL OR p_claimed_amount_minor < 0
     OR p_receipt_storage_path IS NULL
     OR pg_catalog.btrim(p_receipt_storage_path, E' \t\n\r') = ''
     OR pg_catalog.length(p_receipt_storage_path) > 1024
     OR p_reservation_expires_at IS NULL
     OR p_submission_idempotency_key IS NULL
     OR pg_catalog.btrim(p_submission_idempotency_key, E' \t\n\r') = ''
     OR pg_catalog.length(p_submission_idempotency_key) > 128
     OR p_event_idempotency_key IS NULL
     OR pg_catalog.btrim(p_event_idempotency_key, E' \t\n\r') = ''
     OR pg_catalog.length(p_event_idempotency_key) > 128
     OR (p_reference_number IS NOT NULL AND (
       pg_catalog.btrim(p_reference_number, E' \t\n\r') = ''
       OR pg_catalog.length(p_reference_number) > 200
     )) THEN
    RAISE EXCEPTION 'invalid GCash proof input' USING ERRCODE = '22023';
  END IF;

  SELECT p.* INTO v_payment
  FROM public.payments AS p
  WHERE p.id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT s.* INTO v_existing
  FROM public.payment_submissions AS s
  WHERE (s.payment_id = p_payment_id AND s.idempotency_key = p_submission_idempotency_key)
     OR s.receipt_storage_path = p_receipt_storage_path
  ORDER BY (s.payment_id = p_payment_id AND s.idempotency_key = p_submission_idempotency_key) DESC
  LIMIT 1;

  IF FOUND THEN
    SELECT e.* INTO v_existing_event
    FROM public.payment_events AS e
    WHERE e.payment_id = p_payment_id AND e.idempotency_key = p_event_idempotency_key;

    IF v_existing.payment_id = p_payment_id
       AND v_existing.submitted_by = p_submitted_by
       AND v_existing.claimed_amount_minor = p_claimed_amount_minor
       AND v_existing.reference_number IS NOT DISTINCT FROM p_reference_number
       AND v_existing.receipt_storage_path = p_receipt_storage_path
       AND v_existing.idempotency_key = p_submission_idempotency_key
       AND FOUND
       AND v_existing_event.submission_id = v_existing.id
       AND v_existing_event.event_type = 'PROOF_SUBMITTED'
       AND (v_existing_event.metadata ->> 'reservation_expires_at')::TIMESTAMPTZ = p_reservation_expires_at THEN
      RETURN v_existing.id;
    END IF;
    RAISE EXCEPTION 'conflicting GCash proof retry' USING ERRCODE = '23505';
  END IF;

  IF v_payment.method <> 'MANUAL_GCASH' OR v_payment.status NOT IN ('UNPAID', 'REJECTED') THEN
    RAISE EXCEPTION 'payment does not accept a new GCash proof from status %', v_payment.status USING ERRCODE = 'P0001';
  END IF;

  IF p_reservation_expires_at <= pg_catalog.now() THEN
    RAISE EXCEPTION 'invalid GCash proof input' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.orders AS o
    WHERE o.id = v_payment.order_id AND o.user_id = p_submitted_by AND o.status = 'CONFIRMED'
  ) THEN
    RAISE EXCEPTION 'submitter does not own an eligible order' USING ERRCODE = '42501';
  END IF;

  IF p_receipt_storage_path !~ (
       '^' || p_submitted_by::TEXT || '/' || v_payment.order_id::TEXT
       || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
     ) THEN
    RAISE EXCEPTION 'receipt path does not match submitter and order' USING ERRCODE = '22023';
  END IF;

  SELECT o.metadata, o.owner_id INTO v_receipt_metadata, v_receipt_owner_id
  FROM storage.objects AS o
  WHERE o.bucket_id = 'payment-receipts' AND o.name = p_receipt_storage_path;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'receipt object not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_receipt_owner_id IS DISTINCT FROM p_submitted_by::TEXT THEN
    RAISE EXCEPTION 'receipt object owner does not match submitter' USING ERRCODE = '42501';
  END IF;

  -- Storage metadata catches obvious upload mismatches; trusted app code still verifies bytes.
  IF v_receipt_metadata IS NULL
     OR pg_catalog.jsonb_typeof(v_receipt_metadata) <> 'object'
     OR NOT pg_catalog.pg_input_is_valid(v_receipt_metadata ->> 'size', 'bigint')
     OR coalesce(v_receipt_metadata ->> 'mimetype', '') NOT IN ('image/jpeg', 'image/png', 'image/webp') THEN
    RAISE EXCEPTION 'receipt object metadata is invalid' USING ERRCODE = '22023';
  END IF;
  IF (v_receipt_metadata ->> 'size')::BIGINT NOT BETWEEN 1 AND 2097152 THEN
    RAISE EXCEPTION 'receipt object metadata is invalid' USING ERRCODE = '22023';
  END IF;
  IF (CASE pg_catalog.lower(pg_catalog.right(p_receipt_storage_path, 5))
       WHEN '.jpeg' THEN v_receipt_metadata ->> 'mimetype' <> 'image/jpeg'
       WHEN '.webp' THEN v_receipt_metadata ->> 'mimetype' <> 'image/webp'
       ELSE CASE pg_catalog.lower(pg_catalog.right(p_receipt_storage_path, 4))
         WHEN '.jpg' THEN v_receipt_metadata ->> 'mimetype' <> 'image/jpeg'
         WHEN '.png' THEN v_receipt_metadata ->> 'mimetype' <> 'image/png'
         ELSE true
       END
     END) THEN
    RAISE EXCEPTION 'receipt extension does not match MIME type' USING ERRCODE = '22023';
  END IF;

  PERFORM 1
  FROM public.inventory_reservations AS r
  WHERE r.order_id = v_payment.order_id AND r.status = 'active' AND r.expires_at > pg_catalog.now()
  ORDER BY r.variant_id
  FOR UPDATE;
  GET DIAGNOSTICS v_reservation_count = ROW_COUNT;

  IF v_reservation_count = 0 OR EXISTS (
    SELECT 1 FROM public.inventory_reservations AS r
    WHERE r.order_id = v_payment.order_id AND (r.status <> 'active' OR r.expires_at <= pg_catalog.now())
  ) THEN
    RAISE EXCEPTION 'order has no complete valid active reservation set' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.payment_submissions (
    payment_id, submitted_by, claimed_amount_minor, reference_number,
    receipt_storage_path, idempotency_key
  ) VALUES (
    p_payment_id, p_submitted_by, p_claimed_amount_minor, p_reference_number,
    p_receipt_storage_path, p_submission_idempotency_key
  ) RETURNING id INTO v_submission_id;

  UPDATE public.inventory_reservations
  SET expires_at = p_reservation_expires_at
  WHERE order_id = v_payment.order_id AND status = 'active';

  UPDATE public.payments SET status = 'SUBMITTED' WHERE id = p_payment_id;

  INSERT INTO public.payment_events (
    payment_id, submission_id, event_type, from_status, to_status,
    actor_id, idempotency_key, metadata
  ) VALUES (
    p_payment_id, v_submission_id, 'PROOF_SUBMITTED', v_payment.status,
    'SUBMITTED', p_submitted_by, p_event_idempotency_key,
    pg_catalog.jsonb_build_object('reservation_expires_at', p_reservation_expires_at)
  );

  INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, old_values, new_values)
  VALUES (
    p_submitted_by, 'payment.proof_submitted', 'payment', p_payment_id,
    pg_catalog.jsonb_build_object('status', v_payment.status),
    pg_catalog.jsonb_build_object('status', 'SUBMITTED', 'submission_id', v_submission_id)
  );

  RETURN v_submission_id;
END;
$$;

ALTER FUNCTION private.submit_gcash_proof(UUID, UUID, BIGINT, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT) OWNER TO postgres;

-- SECURITY DEFINER atomically approves evidence, takes payment, and consumes stock.
CREATE FUNCTION private.approve_gcash_submission(
  p_payment_id UUID,
  p_submission_id UUID,
  p_reviewer_id UUID,
  p_idempotency_key TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_submission public.payment_submissions%ROWTYPE;
  v_event public.payment_events%ROWTYPE;
  v_reservation RECORD;
BEGIN
  IF p_payment_id IS NULL OR p_submission_id IS NULL OR p_reviewer_id IS NULL
     OR p_idempotency_key IS NULL
     OR pg_catalog.btrim(p_idempotency_key, E' \t\n\r') = ''
     OR pg_catalog.length(p_idempotency_key) > 128
     OR (p_reason IS NOT NULL AND (
       pg_catalog.btrim(p_reason, E' \t\n\r') = '' OR pg_catalog.length(p_reason) > 1000
     )) THEN
    RAISE EXCEPTION 'invalid GCash approval input' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM private.user_roles AS ur
    WHERE ur.user_id = p_reviewer_id AND ur.role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'payment reviewer role required' USING ERRCODE = '42501';
  END IF;

  SELECT p.* INTO v_payment FROM public.payments AS p
  WHERE p.id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT s.* INTO v_submission FROM public.payment_submissions AS s
  WHERE s.id = p_submission_id AND s.payment_id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment submission not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT e.* INTO v_event FROM public.payment_events AS e
  WHERE e.payment_id = p_payment_id AND e.idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_event.event_type = 'PAYMENT_PAID' AND v_event.submission_id = p_submission_id
       AND v_event.actor_id = p_reviewer_id
       AND v_event.reason IS NOT DISTINCT FROM p_reason THEN
      RETURN 'PAID';
    END IF;
    RAISE EXCEPTION 'conflicting GCash approval retry' USING ERRCODE = '23505';
  END IF;

  IF v_payment.method <> 'MANUAL_GCASH' OR v_payment.status NOT IN ('SUBMITTED', 'VERIFYING')
     OR v_submission.review_status NOT IN ('PENDING', 'VERIFYING') THEN
    RAISE EXCEPTION 'GCash submission is not approvable' USING ERRCODE = 'P0001';
  END IF;

  IF v_payment.status = 'SUBMITTED' THEN
    PERFORM private.transition_payment(
      p_payment_id, 'VERIFYING',
      'gcash-approval-review:' || pg_catalog.md5(p_idempotency_key),
      p_reviewer_id, p_submission_id, p_reason, '{}'::JSONB
    );
    v_payment.status := 'VERIFYING';
  END IF;

  FOR v_reservation IN
    SELECT r.id FROM public.inventory_reservations AS r
    WHERE r.order_id = v_payment.order_id
    ORDER BY r.variant_id
    FOR UPDATE
  LOOP
    PERFORM private.transition_inventory_reservation(
      v_reservation.id,
      'consumed',
      'gcash-approval:' || pg_catalog.md5(p_idempotency_key || ':' || v_reservation.id::TEXT),
      p_reviewer_id,
      p_reason
    );
  END LOOP;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment order has no reservations' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.payment_submissions
  SET review_status = 'APPROVED', reviewed_by = p_reviewer_id,
      reviewed_at = pg_catalog.now(), rejection_reason = NULL
  WHERE id = p_submission_id;

  UPDATE public.payments SET status = 'PAID', paid_at = pg_catalog.now()
  WHERE id = p_payment_id;

  INSERT INTO public.payment_events (
    payment_id, submission_id, event_type, from_status, to_status,
    actor_id, reason, idempotency_key
  ) VALUES (
    p_payment_id, p_submission_id, 'PAYMENT_PAID', v_payment.status, 'PAID',
    p_reviewer_id, p_reason, p_idempotency_key
  );

  INSERT INTO public.audit_logs (actor_id, actor_role, action, entity, entity_id, old_values, new_values)
  VALUES (
    p_reviewer_id, NULL, 'payment.gcash_approved', 'payment', p_payment_id,
    pg_catalog.jsonb_build_object('status', v_payment.status),
    pg_catalog.jsonb_build_object('status', 'PAID', 'submission_id', p_submission_id)
  );

  RETURN 'PAID';
END;
$$;

ALTER FUNCTION private.approve_gcash_submission(UUID, UUID, UUID, TEXT, TEXT) OWNER TO postgres;

-- SECURITY DEFINER records a trusted review without releasing retryable stock.
CREATE FUNCTION private.reject_gcash_submission(
  p_payment_id UUID,
  p_submission_id UUID,
  p_reviewer_id UUID,
  p_rejection_reason TEXT,
  p_idempotency_key TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_submission public.payment_submissions%ROWTYPE;
  v_event public.payment_events%ROWTYPE;
  v_reservation RECORD;
  v_final_resolution BOOLEAN;
BEGIN
  IF p_payment_id IS NULL OR p_submission_id IS NULL OR p_reviewer_id IS NULL
     OR p_rejection_reason IS NULL
     OR pg_catalog.btrim(p_rejection_reason, E' \t\n\r') = ''
     OR pg_catalog.length(p_rejection_reason) > 1000
     OR p_idempotency_key IS NULL
     OR pg_catalog.btrim(p_idempotency_key, E' \t\n\r') = ''
     OR pg_catalog.length(p_idempotency_key) > 128 THEN
    RAISE EXCEPTION 'invalid GCash rejection input' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM private.user_roles AS ur
    WHERE ur.user_id = p_reviewer_id AND ur.role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'payment reviewer role required' USING ERRCODE = '42501';
  END IF;

  SELECT p.* INTO v_payment FROM public.payments AS p
  WHERE p.id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT o.* INTO v_order FROM public.orders AS o
  WHERE o.id = v_payment.order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment order not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT s.* INTO v_submission FROM public.payment_submissions AS s
  WHERE s.id = p_submission_id AND s.payment_id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment submission not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT e.* INTO v_event FROM public.payment_events AS e
  WHERE e.payment_id = p_payment_id AND e.idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_event.event_type = 'PROOF_REJECTED' AND v_event.submission_id = p_submission_id
       AND v_event.actor_id = p_reviewer_id
       AND v_event.reason = p_rejection_reason THEN
      RETURN 'REJECTED';
    END IF;
    RAISE EXCEPTION 'conflicting GCash rejection retry' USING ERRCODE = '23505';
  END IF;

  IF v_payment.method <> 'MANUAL_GCASH' OR v_payment.status NOT IN ('SUBMITTED', 'VERIFYING')
     OR v_submission.review_status NOT IN ('PENDING', 'VERIFYING') THEN
    RAISE EXCEPTION 'GCash submission is not rejectable' USING ERRCODE = 'P0001';
  END IF;

  PERFORM 1 FROM public.inventory_reservations AS r
  WHERE r.order_id = v_payment.order_id ORDER BY r.variant_id FOR UPDATE;

  IF NOT FOUND OR EXISTS (
    SELECT 1 FROM public.inventory_reservations AS r
    WHERE r.order_id = v_payment.order_id AND r.status <> 'active'
  ) THEN
    RAISE EXCEPTION 'rejection requires a complete active reservation set' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.inventory_reservations AS r
    WHERE r.order_id = v_payment.order_id AND r.expires_at <= pg_catalog.now()
  ) THEN
    v_final_resolution := false;
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.inventory_reservations AS r
    WHERE r.order_id = v_payment.order_id AND r.expires_at > pg_catalog.now()
  ) THEN
    v_final_resolution := true;
  ELSE
    RAISE EXCEPTION 'rejection requires a uniform reservation deadline state' USING ERRCODE = 'P0001';
  END IF;

  IF v_final_resolution AND v_order.status <> 'CONFIRMED' THEN
    RAISE EXCEPTION 'final rejection requires a confirmed order' USING ERRCODE = 'P0001';
  END IF;

  IF v_final_resolution THEN
    FOR v_reservation IN
      SELECT r.id FROM public.inventory_reservations AS r
      WHERE r.order_id = v_payment.order_id ORDER BY r.variant_id
    LOOP
      PERFORM private.transition_inventory_reservation(
        v_reservation.id, 'expired',
        'gcash-rejection:' || pg_catalog.md5(p_idempotency_key || ':' || v_reservation.id::TEXT),
        p_reviewer_id, p_rejection_reason
      );
    END LOOP;
  END IF;

  UPDATE public.payment_submissions
  SET review_status = 'REJECTED', reviewed_by = p_reviewer_id,
      reviewed_at = pg_catalog.now(), rejection_reason = p_rejection_reason
  WHERE id = p_submission_id;

  UPDATE public.payments SET status = 'REJECTED' WHERE id = p_payment_id;

  INSERT INTO public.payment_events (
    payment_id, submission_id, event_type, from_status, to_status,
    actor_id, reason, idempotency_key, metadata
  ) VALUES (
    p_payment_id, p_submission_id, 'PROOF_REJECTED', v_payment.status, 'REJECTED',
    p_reviewer_id, p_rejection_reason, p_idempotency_key,
    pg_catalog.jsonb_build_object('final_resolution', v_final_resolution)
  );

  IF v_final_resolution THEN
    PERFORM public.transition_order(
      v_order.id, 'CANCELLED', p_rejection_reason, 'gcash_rejection', p_reviewer_id,
      'gcash-rejection:' || pg_catalog.md5(p_idempotency_key || ':' || v_order.id::TEXT),
      pg_catalog.jsonb_build_object('payment_id', p_payment_id, 'submission_id', p_submission_id)
    );
  END IF;

  INSERT INTO public.audit_logs (actor_id, actor_role, action, entity, entity_id, old_values, new_values)
  VALUES (
    p_reviewer_id, NULL, 'payment.gcash_rejected', 'payment', p_payment_id,
    pg_catalog.jsonb_build_object('status', v_payment.status),
    pg_catalog.jsonb_build_object(
      'status', 'REJECTED', 'submission_id', p_submission_id,
      'order_status', CASE WHEN v_final_resolution THEN 'CANCELLED' ELSE v_order.status END
    )
  );

  RETURN 'REJECTED';
END;
$$;

ALTER FUNCTION private.reject_gcash_submission(UUID, UUID, UUID, TEXT, TEXT) OWNER TO postgres;

-- SECURITY DEFINER atomically closes only safely resolved, expired payment attempts.
CREATE FUNCTION private.close_expired_gcash_payment(
  p_payment_id UUID,
  p_actor_id UUID,
  p_reason TEXT,
  p_idempotency_key TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_event public.payment_events%ROWTYPE;
  v_latest_submission public.payment_submissions%ROWTYPE;
  v_reservation RECORD;
  v_final_status TEXT;
BEGIN
  IF p_payment_id IS NULL OR p_actor_id IS NULL
     OR p_reason IS NULL OR pg_catalog.btrim(p_reason, E' \t\n\r') = ''
     OR pg_catalog.length(p_reason) > 1000
     OR p_idempotency_key IS NULL
     OR pg_catalog.btrim(p_idempotency_key, E' \t\n\r') = ''
     OR pg_catalog.length(p_idempotency_key) > 128 THEN
    RAISE EXCEPTION 'invalid GCash timeout closure input' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM private.user_roles AS ur
    WHERE ur.user_id = p_actor_id AND ur.role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'payment reviewer role required' USING ERRCODE = '42501';
  END IF;

  SELECT p.* INTO v_payment
  FROM public.payments AS p
  WHERE p.id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT o.* INTO v_order
  FROM public.orders AS o
  WHERE o.id = v_payment.order_id
  FOR UPDATE;

  SELECT e.* INTO v_event
  FROM public.payment_events AS e
  WHERE e.payment_id = p_payment_id AND e.idempotency_key = p_idempotency_key;

  IF FOUND THEN
    IF v_event.event_type IN ('PAYMENT_FAILED', 'PAYMENT_WINDOW_CLOSED')
       AND v_event.actor_id = p_actor_id
       AND v_event.reason = p_reason
       AND v_order.status = 'CANCELLED'
       AND NOT EXISTS (
         SELECT 1 FROM public.inventory_reservations AS r
         WHERE r.order_id = v_order.id AND r.status <> 'expired'
       ) THEN
      RETURN v_payment.status;
    END IF;
    RAISE EXCEPTION 'conflicting GCash timeout closure retry' USING ERRCODE = '23505';
  END IF;

  IF v_payment.method <> 'MANUAL_GCASH' OR v_order.status <> 'CONFIRMED'
     OR v_payment.status NOT IN ('UNPAID', 'REJECTED') THEN
    RAISE EXCEPTION 'payment requires review or is not timeout-closable from status %', v_payment.status
      USING ERRCODE = 'P0001';
  END IF;

  SELECT s.* INTO v_latest_submission
  FROM public.payment_submissions AS s
  WHERE s.payment_id = p_payment_id
  ORDER BY s.created_at DESC, s.id DESC
  LIMIT 1
  FOR UPDATE;

  IF (v_payment.status = 'UNPAID' AND FOUND)
     OR (v_payment.status = 'REJECTED' AND (
       NOT FOUND OR v_latest_submission.review_status <> 'REJECTED'
     )) THEN
    RAISE EXCEPTION 'payment evidence requires explicit review' USING ERRCODE = 'P0001';
  END IF;

  FOR v_reservation IN
    SELECT r.id, r.expires_at
    FROM public.inventory_reservations AS r
    WHERE r.order_id = v_order.id
    ORDER BY r.variant_id
    FOR UPDATE
  LOOP
    IF v_reservation.expires_at > pg_catalog.now() THEN
      RAISE EXCEPTION 'payment retry window has not expired' USING ERRCODE = 'P0001';
    END IF;

    PERFORM private.transition_inventory_reservation(
      v_reservation.id,
      'expired',
      'gcash-timeout:' || pg_catalog.md5(p_idempotency_key || ':' || v_reservation.id::TEXT),
      p_actor_id,
      p_reason
    );
  END LOOP;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment order has no reservations' USING ERRCODE = 'P0001';
  END IF;

  IF v_payment.status = 'UNPAID' THEN
    v_final_status := private.transition_payment(
      p_payment_id, 'FAILED', p_idempotency_key, p_actor_id, NULL, p_reason, '{}'::JSONB
    );
  ELSE
    v_final_status := 'REJECTED';
    INSERT INTO public.payment_events (
      payment_id, submission_id, event_type, from_status, to_status,
      actor_id, reason, idempotency_key
    ) VALUES (
      p_payment_id, v_latest_submission.id, 'PAYMENT_WINDOW_CLOSED',
      'REJECTED', 'REJECTED', p_actor_id, p_reason, p_idempotency_key
    );
  END IF;

  UPDATE public.orders
  SET status = 'CANCELLED', cancellation_reason = p_reason
  WHERE id = v_order.id;

  INSERT INTO public.order_status_history (
    order_id, from_status, to_status, note, source, changed_by,
    idempotency_key, metadata
  ) VALUES (
    v_order.id, 'CONFIRMED', 'CANCELLED', p_reason, 'gcash_timeout', p_actor_id,
    'gcash-timeout:' || pg_catalog.md5(p_idempotency_key || ':' || v_order.id::TEXT),
    pg_catalog.jsonb_build_object('payment_id', p_payment_id)
  );

  INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, old_values, new_values)
  VALUES (
    p_actor_id, 'payment.timeout_closed', 'payment', p_payment_id,
    pg_catalog.jsonb_build_object('payment_status', v_payment.status, 'order_status', v_order.status),
    pg_catalog.jsonb_build_object('payment_status', v_final_status, 'order_status', 'CANCELLED')
  );

  RETURN v_final_status;
END;
$$;

ALTER FUNCTION private.close_expired_gcash_payment(UUID, UUID, TEXT, TEXT) OWNER TO postgres;

-- SECURITY DEFINER makes checkout one server-only transaction over authoritative rows.
CREATE FUNCTION public.checkout_order(
  p_customer_id UUID,
  p_idempotency_key TEXT,
  p_lines JSONB,
  p_shipping_minor BIGINT,
  p_payment_method TEXT,
  p_gcash_expires_at TIMESTAMPTZ,
  p_delivery JSONB,
  p_customer_note TEXT DEFAULT NULL
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_line RECORD;
  v_variant RECORD;
  v_reservation_id UUID;
  v_subtotal BIGINT := 0;
  v_line_count INTEGER;
  v_order_number TEXT;
  v_expires_at TIMESTAMPTZ;
BEGIN
  IF p_customer_id IS NULL
     OR p_idempotency_key IS NULL
     OR pg_catalog.btrim(p_idempotency_key, E' \t\n\r') = ''
     OR pg_catalog.length(p_idempotency_key) > 128
     OR p_lines IS NULL OR pg_catalog.jsonb_typeof(p_lines) <> 'array'
     OR pg_catalog.jsonb_array_length(p_lines) NOT BETWEEN 1 AND 100
     OR pg_catalog.pg_column_size(p_lines) > 65536
     OR p_shipping_minor IS NULL OR p_shipping_minor < 0
     OR p_payment_method NOT IN ('COD', 'MANUAL_GCASH')
     OR p_delivery IS NULL OR pg_catalog.jsonb_typeof(p_delivery) <> 'object'
     OR pg_catalog.pg_column_size(p_delivery) > 16384
      OR (p_payment_method = 'MANUAL_GCASH' AND p_gcash_expires_at IS NULL)
     OR (p_payment_method = 'COD' AND p_gcash_expires_at IS NOT NULL)
     OR (p_customer_note IS NOT NULL AND pg_catalog.btrim(p_customer_note) = '') THEN
    RAISE EXCEPTION 'invalid checkout input' USING ERRCODE = '22023';
  END IF;

  IF nullif(pg_catalog.btrim(p_delivery ->> 'customer_email'), '') IS NULL
     OR p_delivery - 'customer_email' - 'recipient_name' - 'recipient_phone'
          - 'address_line1' - 'address_line2' - 'barangay' - 'city_municipality'
          - 'province' - 'postal_code' - 'country_code' <> '{}'::JSONB
     OR nullif(pg_catalog.btrim(p_delivery ->> 'recipient_name'), '') IS NULL
     OR nullif(pg_catalog.btrim(p_delivery ->> 'recipient_phone'), '') IS NULL
     OR nullif(pg_catalog.btrim(p_delivery ->> 'address_line1'), '') IS NULL
     OR nullif(pg_catalog.btrim(p_delivery ->> 'city_municipality'), '') IS NULL
     OR nullif(pg_catalog.btrim(p_delivery ->> 'province'), '') IS NULL
     OR nullif(pg_catalog.btrim(p_delivery ->> 'postal_code'), '') IS NULL
     OR coalesce(p_delivery ->> 'country_code', 'PH') !~ '^[A-Z]{2}$' THEN
    RAISE EXCEPTION 'invalid checkout delivery snapshot' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(p_lines) AS line(value)
    WHERE pg_catalog.jsonb_typeof(line.value) <> 'object'
       OR line.value - 'variant_id' - 'quantity' <> '{}'::JSONB
       OR NOT pg_catalog.pg_input_is_valid(line.value ->> 'variant_id', 'uuid')
       OR coalesce(line.value ->> 'quantity', '') !~ '^[1-9][0-9]*$'
  ) THEN
    RAISE EXCEPTION 'invalid checkout line' USING ERRCODE = '22023';
  END IF;

  IF (SELECT count(*) FROM pg_catalog.jsonb_array_elements(p_lines)) <>
     (SELECT count(DISTINCT (line.value ->> 'variant_id')::UUID)
      FROM pg_catalog.jsonb_array_elements(p_lines) AS line(value)) THEN
    RAISE EXCEPTION 'duplicate checkout variant' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('checkout:' || p_idempotency_key, 0)
  );

  SELECT o.* INTO v_order
  FROM public.orders AS o
  WHERE o.idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF FOUND THEN
    SELECT p.* INTO v_payment FROM public.payments AS p WHERE p.order_id = v_order.id;
    IF v_order.user_id = p_customer_id
       AND v_order.shipping_minor = p_shipping_minor
       AND v_order.discount_minor = 0
       AND v_order.customer_email = pg_catalog.btrim(p_delivery ->> 'customer_email')
       AND v_order.recipient_name = pg_catalog.btrim(p_delivery ->> 'recipient_name')
       AND v_order.recipient_phone = pg_catalog.btrim(p_delivery ->> 'recipient_phone')
       AND v_order.address_line1 = pg_catalog.btrim(p_delivery ->> 'address_line1')
       AND v_order.address_line2 IS NOT DISTINCT FROM nullif(pg_catalog.btrim(p_delivery ->> 'address_line2'), '')
       AND v_order.barangay IS NOT DISTINCT FROM nullif(pg_catalog.btrim(p_delivery ->> 'barangay'), '')
       AND v_order.city_municipality = pg_catalog.btrim(p_delivery ->> 'city_municipality')
       AND v_order.province = pg_catalog.btrim(p_delivery ->> 'province')
       AND v_order.postal_code = pg_catalog.btrim(p_delivery ->> 'postal_code')
       AND v_order.country_code = coalesce(p_delivery ->> 'country_code', 'PH')
       AND v_order.customer_note IS NOT DISTINCT FROM p_customer_note
       AND v_payment.method = p_payment_method
       AND EXISTS (
         SELECT 1 FROM public.audit_logs AS a
         WHERE a.action = 'order.checked_out' AND a.entity = 'order'
           AND a.entity_id = v_order.id
           AND (a.new_values ->> 'gcash_expires_at')::TIMESTAMPTZ
               IS NOT DISTINCT FROM p_gcash_expires_at
       )
       AND (SELECT count(*) FROM public.order_items AS oi WHERE oi.order_id = v_order.id)
           = pg_catalog.jsonb_array_length(p_lines)
       AND NOT EXISTS (
         SELECT 1
         FROM pg_catalog.jsonb_array_elements(p_lines) AS line(value)
         WHERE NOT EXISTS (
           SELECT 1 FROM public.order_items AS oi
           WHERE oi.order_id = v_order.id
             AND oi.variant_id = (line.value ->> 'variant_id')::UUID
             AND oi.quantity = (line.value ->> 'quantity')::INTEGER
         )
       ) THEN
      RETURN v_order;
    END IF;
    RAISE EXCEPTION 'conflicting checkout retry' USING ERRCODE = '23505';
  END IF;

  IF p_payment_method = 'MANUAL_GCASH' AND p_gcash_expires_at <= pg_catalog.now() THEN
    RAISE EXCEPTION 'invalid checkout input' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users AS u WHERE u.id = p_customer_id) THEN
    RAISE EXCEPTION 'checkout customer not found' USING ERRCODE = 'P0002';
  END IF;

  FOR v_variant IN
    SELECT v.id, v.price_minor, i.on_hand, i.reserved, i.safety_stock
    FROM public.product_variants AS v
    JOIN public.products AS p ON p.id = v.product_id
    JOIN public.inventory AS i ON i.variant_id = v.id
    JOIN (
      SELECT (line.value ->> 'variant_id')::UUID AS variant_id
      FROM pg_catalog.jsonb_array_elements(p_lines) AS line(value)
    ) AS requested ON requested.variant_id = v.id
    WHERE v.status = 'active' AND p.status = 'published'
    ORDER BY v.id
    FOR UPDATE OF p, v, i
  LOOP
    SELECT (line.value ->> 'quantity')::INTEGER INTO STRICT v_line_count
    FROM pg_catalog.jsonb_array_elements(p_lines) AS line(value)
    WHERE (line.value ->> 'variant_id')::UUID = v_variant.id;
    IF v_variant.on_hand - v_variant.reserved - v_variant.safety_stock < v_line_count THEN
      RAISE EXCEPTION 'insufficient available inventory for variant %', v_variant.id USING ERRCODE = 'P0001';
    END IF;
    v_subtotal := v_subtotal + v_variant.price_minor * v_line_count;
  END LOOP;

  IF (SELECT count(*) FROM public.product_variants AS v
      JOIN public.products AS p ON p.id = v.product_id
      JOIN public.inventory AS i ON i.variant_id = v.id
      WHERE v.id IN (SELECT (line.value ->> 'variant_id')::UUID FROM pg_catalog.jsonb_array_elements(p_lines) AS line(value))
        AND v.status = 'active' AND p.status = 'published') <> pg_catalog.jsonb_array_length(p_lines) THEN
    RAISE EXCEPTION 'checkout contains unavailable variant' USING ERRCODE = 'P0001';
  END IF;

  LOOP
    v_order_number := 'ORD-' || pg_catalog.to_char(pg_catalog.clock_timestamp() AT TIME ZONE 'UTC', 'YYYYMMDD')
      || '-' || pg_catalog.upper(pg_catalog.substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::TEXT, '-', ''), 1, 10));
    BEGIN
      INSERT INTO public.orders (
        order_number, user_id, idempotency_key, status, subtotal_minor,
        discount_minor, shipping_minor, total_minor, customer_email,
        recipient_name, recipient_phone, address_line1, address_line2, barangay,
        city_municipality, province, postal_code, country_code, customer_note
      ) VALUES (
        v_order_number, p_customer_id, p_idempotency_key, 'CONFIRMED', v_subtotal,
        0, p_shipping_minor, v_subtotal + p_shipping_minor,
        pg_catalog.btrim(p_delivery ->> 'customer_email'),
        pg_catalog.btrim(p_delivery ->> 'recipient_name'),
        pg_catalog.btrim(p_delivery ->> 'recipient_phone'),
        pg_catalog.btrim(p_delivery ->> 'address_line1'),
        nullif(pg_catalog.btrim(p_delivery ->> 'address_line2'), ''),
        nullif(pg_catalog.btrim(p_delivery ->> 'barangay'), ''),
        pg_catalog.btrim(p_delivery ->> 'city_municipality'),
        pg_catalog.btrim(p_delivery ->> 'province'),
        pg_catalog.btrim(p_delivery ->> 'postal_code'),
        coalesce(p_delivery ->> 'country_code', 'PH'), p_customer_note
      ) RETURNING * INTO v_order;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      -- Only the random order number can collide while this idempotency key is locked.
      NULL;
    END;
  END LOOP;

  FOR v_line IN
    SELECT (line.value ->> 'variant_id')::UUID AS variant_id,
           (line.value ->> 'quantity')::INTEGER AS quantity
    FROM pg_catalog.jsonb_array_elements(p_lines) AS line(value)
    ORDER BY 1
  LOOP
    SELECT v.*, p.name AS product_name INTO STRICT v_variant
    FROM public.product_variants AS v
    JOIN public.products AS p ON p.id = v.product_id
    WHERE v.id = v_line.variant_id;

    INSERT INTO public.order_items (
      order_id, product_id, variant_id, product_name, variant_name, sku,
      selected_options, quantity, unit_price_minor, unit_discount_minor,
      line_subtotal_minor, line_discount_minor, line_total_minor
    ) VALUES (
      v_order.id, v_variant.product_id, v_variant.id, v_variant.product_name,
      v_variant.name, v_variant.sku,
      coalesce((
        SELECT pg_catalog.jsonb_object_agg(po.name, pov.value ORDER BY po.position)
        FROM public.variant_option_values AS vov
        JOIN public.product_options AS po ON po.id = vov.option_id
        JOIN public.product_option_values AS pov ON pov.id = vov.option_value_id
        WHERE vov.variant_id = v_variant.id
      ), '{}'::JSONB),
      v_line.quantity, v_variant.price_minor, 0,
      v_variant.price_minor * v_line.quantity, 0,
      v_variant.price_minor * v_line.quantity
    );
  END LOOP;

  INSERT INTO public.payments (order_id, method, amount_minor, currency_code, idempotency_key)
  VALUES (
    v_order.id, p_payment_method, v_order.total_minor, 'PHP',
    'checkout-payment:' || pg_catalog.md5(p_idempotency_key)
  ) RETURNING * INTO v_payment;

  v_expires_at := coalesce(p_gcash_expires_at, pg_catalog.now() + INTERVAL '5 minutes');
  FOR v_line IN
    SELECT oi.variant_id, oi.quantity
    FROM public.order_items AS oi WHERE oi.order_id = v_order.id ORDER BY oi.variant_id
  LOOP
    v_reservation_id := private.reserve_inventory(
      v_order.id, v_line.variant_id, v_line.quantity, v_expires_at,
      'checkout-reserve:' || pg_catalog.md5(p_idempotency_key || ':' || v_line.variant_id::TEXT),
      p_customer_id
    );
    IF p_payment_method = 'COD' THEN
      PERFORM private.transition_inventory_reservation(
        v_reservation_id, 'consumed',
        'checkout-consume:' || pg_catalog.md5(p_idempotency_key || ':' || v_line.variant_id::TEXT),
        p_customer_id, 'COD order accepted'
      );
    END IF;
  END LOOP;

  INSERT INTO public.audit_logs (actor_id, actor_role, action, entity, entity_id, new_values)
  VALUES (
    p_customer_id, 'customer', 'order.checked_out', 'order', v_order.id,
    pg_catalog.jsonb_build_object(
      'payment_method', p_payment_method, 'total_minor', v_order.total_minor,
      'gcash_expires_at', p_gcash_expires_at
    )
  );

  RETURN v_order;
END;
$$;

ALTER FUNCTION public.checkout_order(UUID, TEXT, JSONB, BIGINT, TEXT, TIMESTAMPTZ, JSONB, TEXT) OWNER TO postgres;

-- SECURITY DEFINER is required to change the private role relation after AAL2 authorization.
CREATE FUNCTION public.manage_user_role(p_user_id UUID, p_role TEXT, p_assign BOOLEAN)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_changed BOOLEAN;
  v_row_count INTEGER;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  IF coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' THEN
    RAISE EXCEPTION 'AAL2 required' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(719736238512950481::BIGINT);

  IF NOT private.has_role('super_admin') THEN
    RAISE EXCEPTION 'super_admin required' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL OR p_role NOT IN ('admin', 'super_admin') OR p_assign IS NULL
     OR NOT EXISTS (SELECT 1 FROM auth.users AS u WHERE u.id = p_user_id) THEN
    RAISE EXCEPTION 'invalid role operation' USING ERRCODE = '22023';
  END IF;

  IF p_assign THEN
    INSERT INTO private.user_roles (user_id, role, assigned_by)
    VALUES (p_user_id, p_role, v_actor)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    IF p_role = 'super_admin'
       AND EXISTS (SELECT 1 FROM private.user_roles WHERE user_id = p_user_id AND role = 'super_admin')
       AND (SELECT count(*) FROM private.user_roles WHERE role = 'super_admin') = 1 THEN
      RAISE EXCEPTION 'cannot remove the last super_admin' USING ERRCODE = '23514';
    END IF;
    DELETE FROM private.user_roles WHERE user_id = p_user_id AND role = p_role;
  END IF;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  v_changed := v_row_count > 0;

  IF v_changed THEN
    INSERT INTO public.audit_logs (
      actor_id, actor_role, action, entity, entity_id, old_values, new_values
    ) VALUES (
      v_actor, 'super_admin',
      CASE WHEN p_assign THEN 'role.assigned' ELSE 'role.removed' END,
      'user_role', p_user_id,
      CASE WHEN p_assign THEN NULL ELSE pg_catalog.jsonb_build_object('role', p_role) END,
      CASE WHEN p_assign THEN pg_catalog.jsonb_build_object('role', p_role) ELSE NULL END
    );
  END IF;

  RETURN v_changed;
END;
$$;

ALTER FUNCTION public.manage_user_role(UUID, TEXT, BOOLEAN) OWNER TO postgres;
