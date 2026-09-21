-- Migration: 20260920000000_domain_hierarchy_expansion.sql
-- Purpose: Complete Phase 0 Domain Design and Phase 1 Database/Business Rules
-- Adds: Sales Channel, Fulfillment Method, Register Sessions, Shipments, Returns/Refunds, Store Settings, Cashier Role

-- 1. Extend orders table with explicit sales channel and fulfillment method
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS sales_channel TEXT NOT NULL DEFAULT 'STOREFRONT'
    CHECK (sales_channel IN ('STOREFRONT', 'POS')),
  ADD COLUMN IF NOT EXISTS fulfillment_method TEXT NOT NULL DEFAULT 'SHIPMENT'
    CHECK (fulfillment_method IN ('SHIPMENT', 'STORE_PICKUP')),
  ADD COLUMN IF NOT EXISTS register_session_id UUID;

CREATE INDEX IF NOT EXISTS orders_sales_channel_idx
  ON public.orders (sales_channel, created_at DESC);

CREATE INDEX IF NOT EXISTS orders_fulfillment_method_idx
  ON public.orders (fulfillment_method, created_at DESC);

-- 2. Extend payments table to support CASH counter payment & refund transitions
ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_method_check;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_method_check
    CHECK (method IN ('COD', 'MANUAL_GCASH', 'CASH'));

-- Allow payment transitions to refund states
CREATE OR REPLACE FUNCTION private.validate_payment_transition()
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
    ('REJECTED', 'SUBMITTED'),
    ('PAID', 'REFUND_PENDING'),
    ('PAID', 'PARTIALLY_REFUNDED'),
    ('PAID', 'REFUNDED'),
    ('REFUND_PENDING', 'PARTIALLY_REFUNDED'),
    ('REFUND_PENDING', 'REFUNDED'),
    ('REFUND_PENDING', 'PAID'),
    ('PARTIALLY_REFUNDED', 'REFUNDED')
  ) THEN
    RAISE EXCEPTION 'invalid payment transition: % -> %', OLD.status, NEW.status
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION private.validate_payment_transition() OWNER TO postgres;

-- Allow REFUND_PROCESSED event type on payment_events
ALTER TABLE public.payment_events
  DROP CONSTRAINT IF EXISTS payment_events_event_type_check;

ALTER TABLE public.payment_events
  ADD CONSTRAINT payment_events_event_type_check
    CHECK (event_type IN (
      'PAYMENT_CREATED', 'PROOF_SUBMITTED', 'REVIEW_STARTED', 'PAYMENT_PAID',
      'PAYMENT_FAILED', 'PROOF_REJECTED', 'PAYMENT_WINDOW_CLOSED', 'REFUND_PROCESSED'
    ));

-- 3. Extend private.user_roles to support cashier role
ALTER TABLE private.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_role_check;

ALTER TABLE private.user_roles
  ADD CONSTRAINT user_roles_role_check
    CHECK (role IN ('customer', 'cashier', 'admin', 'super_admin'));

-- Update private.has_role function to support cashier
GRANT app_rls_role_reader TO postgres;

CREATE OR REPLACE FUNCTION private.has_role(required_role text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  subject_id uuid := private.current_auth_uid();
BEGIN
  IF required_role IS NULL
     OR required_role NOT IN ('customer', 'cashier', 'admin', 'super_admin') THEN
    RAISE EXCEPTION 'unsupported role: %', required_role
      USING errcode = '22023';
  END IF;

  IF subject_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM private.user_roles AS ur
    WHERE ur.user_id = subject_id
      AND ur.role = required_role
  );
END;
$$;

ALTER FUNCTION private.has_role(text) OWNER TO app_rls_role_reader;
REVOKE app_rls_role_reader FROM postgres;

-- 4. Create register_sessions table for cashier shifts & drawer management
CREATE TABLE IF NOT EXISTS public.register_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cashier_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  opening_cash_minor BIGINT NOT NULL DEFAULT 0 CHECK (opening_cash_minor >= 0),
  expected_cash_minor BIGINT NOT NULL DEFAULT 0 CHECK (expected_cash_minor >= 0),
  actual_cash_minor BIGINT CHECK (actual_cash_minor IS NULL OR actual_cash_minor >= 0),
  cash_difference_minor BIGINT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (status = 'OPEN' AND closed_at IS NULL AND actual_cash_minor IS NULL)
    OR (status = 'CLOSED' AND closed_at IS NOT NULL AND actual_cash_minor IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS register_sessions_cashier_idx
  ON public.register_sessions (cashier_id, created_at DESC);

CREATE INDEX IF NOT EXISTS register_sessions_status_idx
  ON public.register_sessions (status);

-- Foreign key on orders linking to register session
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_register_session_fk'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_register_session_fk
      FOREIGN KEY (register_session_id)
      REFERENCES public.register_sessions (id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 4b. Create register_session_activities table for immutable cash movement/activity history
CREATE TABLE IF NOT EXISTS public.register_session_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.register_sessions (id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'OPEN_FLOAT',
    'CASH_SALE',
    'CASH_REFUND',
    'EXCHANGE_BALANCE_COLLECTED',
    'EXCHANGE_REFUND_PAID',
    'PAY_IN',
    'PAY_OUT',
    'CLOSE_FLOAT'
  )),
  amount_minor BIGINT NOT NULL,
  running_balance_minor BIGINT NOT NULL,
  order_id UUID REFERENCES public.orders (id) ON DELETE SET NULL,
  reference_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS register_session_activities_session_idx
  ON public.register_session_activities (session_id, created_at ASC);

-- Enforce append-only immutability
CREATE TRIGGER register_session_activities_reject_mutation
  BEFORE UPDATE OR DELETE ON public.register_session_activities
  FOR EACH ROW
  EXECUTE FUNCTION private.reject_append_only_mutation();

-- 5. Create shipments table for provider-neutral fulfillment & tracking
CREATE TABLE IF NOT EXISTS public.shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders (id) ON DELETE RESTRICT,
  provider TEXT NOT NULL DEFAULT 'MANUAL'
    CHECK (provider IN ('MANUAL', 'LBC', 'JNT', 'J&T', 'GOGO', 'OTHER')),
  tracking_number TEXT CHECK (
    tracking_number IS NULL OR (
      btrim(tracking_number) <> '' AND length(tracking_number) <= 100
    )
  ),
  tracking_url TEXT CHECK (
    tracking_url IS NULL OR (
      btrim(tracking_url) <> '' AND length(tracking_url) <= 1000
    )
  ),
  carrier_notes TEXT CHECK (
    carrier_notes IS NULL OR btrim(carrier_notes) <> ''
  ),
  shipped_at TIMESTAMPTZ,
  estimated_delivery_at TIMESTAMPTZ,
  actual_delivery_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'PREPARING'
    CHECK (status IN ('PREPARING', 'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shipments_order_id_idx
  ON public.shipments (order_id);

CREATE INDEX IF NOT EXISTS shipments_status_idx
  ON public.shipments (status);

-- 6. Create return_requests table
CREATE TABLE IF NOT EXISTS public.return_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders (id) ON DELETE RESTRICT,
  user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'RETURN'
    CHECK (type IN ('RETURN', 'EXCHANGE', 'REFUND_ONLY')),
  status TEXT NOT NULL DEFAULT 'REQUESTED'
    CHECK (status IN ('REQUESTED', 'APPROVED', 'ITEMS_RECEIVED', 'INSPECTED', 'COMPLETED', 'REJECTED', 'CANCELLED')),
  reason TEXT NOT NULL
    CHECK (reason IN ('DEFECTIVE', 'WRONG_ITEM', 'WRONG_SIZE', 'CHANGE_OF_MIND', 'OTHER')),
  reason_details TEXT,
  exchange_variant_id UUID REFERENCES public.product_variants (id) ON DELETE SET NULL,
  requested_refund_minor BIGINT NOT NULL DEFAULT 0 CHECK (requested_refund_minor >= 0),
  approved_refund_minor BIGINT DEFAULT 0 CHECK (approved_refund_minor >= 0),
  proof_storage_paths TEXT[] NOT NULL DEFAULT '{}',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS return_requests_order_id_idx
  ON public.return_requests (order_id);

CREATE INDEX IF NOT EXISTS return_requests_user_id_idx
  ON public.return_requests (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS return_requests_status_idx
  ON public.return_requests (status);

-- 7. Create refunds table
CREATE TABLE IF NOT EXISTS public.refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments (id) ON DELETE RESTRICT,
  order_id UUID NOT NULL REFERENCES public.orders (id) ON DELETE RESTRICT,
  return_request_id UUID REFERENCES public.return_requests (id) ON DELETE SET NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency_code TEXT NOT NULL DEFAULT 'PHP' CHECK (currency_code ~ '^[A-Z]{3}$'),
  status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
  method TEXT NOT NULL CHECK (method IN ('MANUAL_GCASH', 'CASH', 'ORIGINAL_PAYMENT')),
  reference_number TEXT CHECK (reference_number IS NULL OR btrim(reference_number) <> ''),
  reason TEXT NOT NULL CHECK (btrim(reason) <> ''),
  processed_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS refunds_order_id_idx
  ON public.refunds (order_id);

CREATE INDEX IF NOT EXISTS refunds_payment_id_idx
  ON public.refunds (payment_id);

-- 8. Create store_settings table
CREATE TABLE IF NOT EXISTS public.store_settings (
  key TEXT PRIMARY KEY CHECK (btrim(key) <> ''),
  value JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (
    jsonb_typeof(value) = 'object' OR jsonb_typeof(value) = 'array'
  ),
  description TEXT,
  updated_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default store settings
INSERT INTO public.store_settings (key, value, description)
VALUES
  (
    'announcement',
    '{"enabled": true, "text": "NEW DROP: DROP 01 NOW AVAILABLE — COMPLIMENTARY METRO MANILA SHIPPING OVER ₱3,500", "link": "/products"}'::jsonb,
    'Storefront header announcement banner configuration'
  ),
  (
    'hero',
    '{"title": "1968 CLOTHING", "subtitle": "DEFEND THE CULTURE. ARCHIVAL STREETWEAR.", "cta_text": "EXPLORE DROP 01", "cta_link": "/products"}'::jsonb,
    'Homepage hero section typography and primary action'
  ),
  (
    'fulfillment',
    '{"shipping_fee_minor": 15000, "free_shipping_threshold_minor": 350000, "allow_store_pickup": true, "pickup_address": "1968 Flagship Store, Makati City"}'::jsonb,
    'Shipping rates, free delivery threshold, and store pickup options'
  ),
  (
    'payment',
    '{"gcash_enabled": true, "gcash_number": "0917-196-8000", "gcash_account_name": "1968 CLOTHING PH", "cod_enabled": true, "cod_max_minor": 1000000}'::jsonb,
    'Payment gateway toggles and Manual GCash account configuration'
  ),
  (
    'collections',
    '[{"slug": "tops", "name": "Heavyweight Tees & Tops"}, {"slug": "outerwear", "name": "Jackets & Hoodies"}, {"slug": "accessories", "name": "Headwear & Bags"}]'::jsonb,
    'Curated collection links displayed on homepage and navigation'
  )
ON CONFLICT (key) DO NOTHING;

-- 9. Update validate_order_transition to allow in-store pickup & counter handover
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

  RETURN new;
END;
$$;

-- 10. Enable Row Level Security (RLS) on all new tables
ALTER TABLE public.register_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.register_session_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT ON public.store_settings TO anon, authenticated;
GRANT ALL ON public.store_settings TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.register_sessions TO authenticated;
GRANT ALL ON public.register_sessions TO service_role;

GRANT SELECT, INSERT ON public.register_session_activities TO authenticated;
GRANT ALL ON public.register_session_activities TO service_role;

GRANT SELECT ON public.shipments TO authenticated;
GRANT ALL ON public.shipments TO service_role;

GRANT SELECT, INSERT ON public.return_requests TO authenticated;
GRANT ALL ON public.return_requests TO service_role;

GRANT SELECT ON public.refunds TO authenticated;
GRANT ALL ON public.refunds TO service_role;

-- Policies for store_settings
CREATE POLICY store_settings_public_read
  ON public.store_settings FOR SELECT
  TO public
  USING (true);

CREATE POLICY store_settings_admin_mutate
  ON public.store_settings FOR ALL
  TO authenticated
  USING (private.has_role('admin') OR private.has_role('super_admin'))
  WITH CHECK (private.has_role('admin') OR private.has_role('super_admin'));

-- Policies for register_sessions
CREATE POLICY register_sessions_cashier_select
  ON public.register_sessions FOR SELECT
  TO authenticated
  USING (
    cashier_id = auth.uid()
    OR private.has_role('admin')
    OR private.has_role('super_admin')
  );

CREATE POLICY register_sessions_cashier_insert
  ON public.register_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    cashier_id = auth.uid()
    AND (
      private.has_role('cashier')
      OR private.has_role('admin')
      OR private.has_role('super_admin')
    )
  );

CREATE POLICY register_sessions_cashier_update
  ON public.register_sessions FOR UPDATE
  TO authenticated
  USING (
    cashier_id = auth.uid()
    OR private.has_role('admin')
    OR private.has_role('super_admin')
  )
  WITH CHECK (
    cashier_id = auth.uid()
    OR private.has_role('admin')
    OR private.has_role('super_admin')
  );

-- Policies for register_session_activities
CREATE POLICY register_session_activities_select
  ON public.register_session_activities FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR private.has_role('admin')
    OR private.has_role('super_admin')
  );

CREATE POLICY register_session_activities_insert
  ON public.register_session_activities FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      private.has_role('cashier')
      OR private.has_role('admin')
      OR private.has_role('super_admin')
    )
  );

-- Policies for shipments
CREATE POLICY shipments_customer_select
  ON public.shipments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders AS o
      WHERE o.id = shipments.order_id
        AND o.user_id = auth.uid()
    )
    OR private.has_role('admin')
    OR private.has_role('super_admin')
  );

CREATE POLICY shipments_admin_all
  ON public.shipments FOR ALL
  TO authenticated
  USING (private.has_role('admin') OR private.has_role('super_admin'))
  WITH CHECK (private.has_role('admin') OR private.has_role('super_admin'));

-- Policies for return_requests
CREATE POLICY return_requests_customer_select
  ON public.return_requests FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR private.has_role('admin')
    OR private.has_role('super_admin')
  );

CREATE POLICY return_requests_customer_insert
  ON public.return_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.orders AS o
      WHERE o.id = return_requests.order_id
        AND o.user_id = auth.uid()
    )
  );

CREATE POLICY return_requests_admin_all
  ON public.return_requests FOR ALL
  TO authenticated
  USING (private.has_role('admin') OR private.has_role('super_admin'))
  WITH CHECK (private.has_role('admin') OR private.has_role('super_admin'));

-- Policies for refunds
CREATE POLICY refunds_customer_select
  ON public.refunds FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders AS o
      WHERE o.id = refunds.order_id
        AND o.user_id = auth.uid()
    )
    OR private.has_role('admin')
    OR private.has_role('super_admin')
  );

CREATE POLICY refunds_admin_all
  ON public.refunds FOR ALL
  TO authenticated
  USING (private.has_role('admin') OR private.has_role('super_admin'))
  WITH CHECK (private.has_role('admin') OR private.has_role('super_admin'));

-- 11. Storage Bucket for return-proofs
INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'return-proofs',
  'return-proofs',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for return-proofs
CREATE POLICY return_proofs_owner_insert
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'return-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY return_proofs_owner_read
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'return-proofs'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR private.has_role('admin')
      OR private.has_role('super_admin')
    )
  );

-- 12. Transactional RPCs for Domain Operations

-- A. Open Cashier Register Session
CREATE OR REPLACE FUNCTION public.open_register_session(
  p_opening_cash_minor BIGINT,
  p_notes TEXT DEFAULT NULL
)
RETURNS public.register_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cashier_id UUID := auth.uid();
  v_existing_id UUID;
  v_session public.register_sessions;
BEGIN
  IF v_cashier_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = '42501';
  END IF;

  IF NOT (
    private.has_role('cashier')
    OR private.has_role('admin')
    OR private.has_role('super_admin')
  ) THEN
    RAISE EXCEPTION 'insufficient role to open register' USING errcode = '42501';
  END IF;

  IF p_opening_cash_minor < 0 THEN
    RAISE EXCEPTION 'opening cash cannot be negative' USING errcode = '23514';
  END IF;

  -- Check if already has an open session
  SELECT id INTO v_existing_id
  FROM public.register_sessions
  WHERE cashier_id = v_cashier_id
    AND status = 'OPEN'
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    SELECT * INTO v_session
    FROM public.register_sessions
    WHERE id = v_existing_id;
    RETURN v_session;
  END IF;

  INSERT INTO public.register_sessions (
    cashier_id,
    status,
    opened_at,
    opening_cash_minor,
    expected_cash_minor,
    notes
  )
  VALUES (
    v_cashier_id,
    'OPEN',
    now(),
    p_opening_cash_minor,
    p_opening_cash_minor, -- expected starts with opening cash
    p_notes
  )
  RETURNING * INTO v_session;

  INSERT INTO public.register_session_activities (
    session_id,
    activity_type,
    amount_minor,
    running_balance_minor,
    notes,
    created_by
  )
  VALUES (
    v_session.id,
    'OPEN_FLOAT',
    p_opening_cash_minor,
    p_opening_cash_minor,
    coalesce(p_notes, 'Opening float'),
    v_cashier_id
  );

  RETURN v_session;
END;
$$;

-- B. Close Cashier Register Session
CREATE OR REPLACE FUNCTION public.close_register_session(
  p_session_id UUID,
  p_actual_cash_minor BIGINT,
  p_notes TEXT DEFAULT NULL
)
RETURNS public.register_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cashier_id UUID := auth.uid();
  v_session public.register_sessions;
  v_diff BIGINT;
BEGIN
  IF v_cashier_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = '42501';
  END IF;

  IF p_actual_cash_minor < 0 THEN
    RAISE EXCEPTION 'actual cash cannot be negative' USING errcode = '23514';
  END IF;

  SELECT * INTO v_session
  FROM public.register_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'register session not found' USING errcode = 'P0002';
  END IF;

  IF v_session.status <> 'OPEN' THEN
    RAISE EXCEPTION 'register session is already closed' USING errcode = '23514';
  END IF;

  IF v_session.cashier_id <> v_cashier_id
     AND NOT (private.has_role('admin') OR private.has_role('super_admin')) THEN
    RAISE EXCEPTION 'unauthorized to close another cashier session' USING errcode = '42501';
  END IF;

  v_diff := p_actual_cash_minor - v_session.expected_cash_minor;

  UPDATE public.register_sessions
  SET
    status = 'CLOSED',
    closed_at = now(),
    actual_cash_minor = p_actual_cash_minor,
    cash_difference_minor = v_diff,
    notes = coalesce(p_notes, notes),
    updated_at = now()
  WHERE id = p_session_id
  RETURNING * INTO v_session;

  INSERT INTO public.register_session_activities (
    session_id,
    activity_type,
    amount_minor,
    running_balance_minor,
    notes,
    created_by
  )
  VALUES (
    p_session_id,
    'CLOSE_FLOAT',
    p_actual_cash_minor,
    p_actual_cash_minor,
    coalesce(p_notes, 'Closing float reconciliation (Diff: ' || v_diff::text || ')'),
    v_cashier_id
  );

  RETURN v_session;
END;
$$;

-- C. Create POS Sale (Atomic counter sale supporting Cash tender with change)
CREATE OR REPLACE FUNCTION public.create_pos_sale(
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
  v_staff_id UUID := auth.uid();
  v_order_id UUID;
  v_order_number TEXT;
  v_subtotal_minor BIGINT := 0;
  v_total_minor BIGINT := 0;
  v_change_minor BIGINT := 0;
  v_item JSONB;
  v_variant_id UUID;
  v_qty INT;
  v_unit_price BIGINT;
  v_product_id UUID;
  v_product_name TEXT;
  v_variant_name TEXT;
  v_sku TEXT;
  v_stock INT;
  v_idempotency TEXT;
  v_payment_id UUID;
  v_reservation_id UUID;
BEGIN
  IF v_staff_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = '42501';
  END IF;

  IF NOT (
    private.has_role('cashier')
    OR private.has_role('admin')
    OR private.has_role('super_admin')
  ) THEN
    RAISE EXCEPTION 'insufficient role for POS sale' USING errcode = '42501';
  END IF;

  IF p_payment_method NOT IN ('CASH', 'MANUAL_GCASH') THEN
    RAISE EXCEPTION 'POS payment method must be CASH or MANUAL_GCASH' USING errcode = '23514';
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'cart is empty' USING errcode = '23514';
  END IF;

  v_idempotency := coalesce(p_idempotency_key, 'pos_' || gen_random_uuid()::text);

  -- 1. Calculate items total and verify inventory
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_variant_id := (v_item ->> 'variant_id')::UUID;
    v_qty := (v_item ->> 'quantity')::INT;

    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'invalid quantity' USING errcode = '23514';
    END IF;

    -- Lock and check variant
    SELECT pv.price_minor, pv.product_id, pv.sku, pv.name, p.name, (inv.on_hand - inv.reserved)
    INTO v_unit_price, v_product_id, v_sku, v_variant_name, v_product_name, v_stock
    FROM public.product_variants pv
    JOIN public.products p ON p.id = pv.product_id
    JOIN public.inventory inv ON inv.variant_id = pv.id
    WHERE pv.id = v_variant_id
    FOR UPDATE OF inv;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'variant not found: %', v_variant_id USING errcode = 'P0002';
    END IF;

    IF v_stock < v_qty THEN
      RAISE EXCEPTION 'insufficient inventory for SKU %', v_sku USING errcode = '23514';
    END IF;

    v_subtotal_minor := v_subtotal_minor + (v_unit_price * v_qty);
  END LOOP;

  v_total_minor := v_subtotal_minor;

  -- Verify cash tender
  IF p_payment_method = 'CASH' THEN
    IF p_tendered_minor < v_total_minor THEN
      RAISE EXCEPTION 'tendered amount less than total' USING errcode = '23514';
    END IF;
    v_change_minor := p_tendered_minor - v_total_minor;
  ELSE
    p_tendered_minor := v_total_minor;
    v_change_minor := 0;
  END IF;

  -- 2. Generate canonical order number
  v_order_number := 'ORD-' || to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  -- 3. Insert order directly in CONFIRMED state
  INSERT INTO public.orders (
    order_number,
    user_id,
    idempotency_key,
    status,
    currency_code,
    subtotal_minor,
    discount_minor,
    shipping_minor,
    total_minor,
    customer_email,
    recipient_name,
    recipient_phone,
    address_line1,
    city_municipality,
    province,
    postal_code,
    country_code,
    sales_channel,
    fulfillment_method,
    register_session_id
  )
  VALUES (
    v_order_number,
    v_staff_id,
    v_idempotency,
    'CONFIRMED',
    'PHP',
    v_subtotal_minor,
    0,
    0,
    v_total_minor,
    coalesce(p_customer_email, 'pos.walkin@1968.local'),
    coalesce(p_customer_name, 'Walk-in Customer'),
    coalesce(p_customer_phone, '09000000000'),
    '1968 Flagship Store - POS Counter',
    'Makati City',
    'Metro Manila',
    '1200',
    'PH',
    'POS',
    'STORE_PICKUP',
    p_register_session_id
  )
  RETURNING id INTO v_order_id;

  -- 4. Insert order items & consume inventory directly
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_variant_id := (v_item ->> 'variant_id')::UUID;
    v_qty := (v_item ->> 'quantity')::INT;

    SELECT pv.price_minor, pv.product_id, pv.sku, pv.name, p.name
    INTO v_unit_price, v_product_id, v_sku, v_variant_name, v_product_name
    FROM public.product_variants pv
    JOIN public.products p ON p.id = pv.product_id
    WHERE pv.id = v_variant_id;

    INSERT INTO public.order_items (
      order_id,
      product_id,
      variant_id,
      product_name,
      variant_name,
      sku,
      selected_options,
      quantity,
      unit_price_minor,
      unit_discount_minor,
      line_subtotal_minor,
      line_discount_minor,
      line_total_minor
    )
    VALUES (
      v_order_id,
      v_product_id,
      v_variant_id,
      v_product_name,
      v_variant_name,
      v_sku,
      '{}'::jsonb,
      v_qty,
      v_unit_price,
      0,
      v_unit_price * v_qty,
      0,
      v_unit_price * v_qty
    );

    -- Reserve and immediately consume inventory via canonical private functions
    v_reservation_id := private.reserve_inventory(
      v_order_id,
      v_variant_id,
      v_qty,
      now() + interval '1 day',
      'pos-reserve:' || md5(v_idempotency || ':' || v_variant_id::text),
      v_staff_id
    );

    PERFORM private.transition_inventory_reservation(
      v_reservation_id,
      'consumed',
      'pos-consume:' || md5(v_idempotency || ':' || v_variant_id::text),
      v_staff_id,
      'POS counter sale #' || v_order_number
    );
  END LOOP;

  -- 5. Insert payment initially as UNPAID then transition to PAID upon tender
  INSERT INTO public.payments (
    order_id,
    method,
    status,
    amount_minor,
    currency_code,
    idempotency_key
  )
  VALUES (
    v_order_id,
    p_payment_method,
    'UNPAID',
    v_total_minor,
    'PHP',
    'pay_' || v_idempotency
  )
  RETURNING id INTO v_payment_id;

  UPDATE public.payments
  SET status = 'PAID',
      paid_at = now()
  WHERE id = v_payment_id;

  -- Record payment event
  INSERT INTO public.payment_events (
    payment_id,
    event_type,
    from_status,
    to_status,
    actor_id,
    reason,
    idempotency_key,
    metadata
  )
  VALUES (
    v_payment_id,
    'PAYMENT_PAID',
    'UNPAID',
    'PAID',
    v_staff_id,
    'POS counter sale tender completed',
    'evt_' || v_idempotency,
    jsonb_build_object(
      'tendered_minor', p_tendered_minor,
      'change_minor', v_change_minor,
      'payment_method', p_payment_method
    )
  );

  -- 6. Update register session expected cash if Cash payment
  IF p_payment_method = 'CASH' AND p_register_session_id IS NOT NULL THEN
    UPDATE public.register_sessions
    SET expected_cash_minor = expected_cash_minor + v_total_minor,
        updated_at = now()
    WHERE id = p_register_session_id;

    INSERT INTO public.register_session_activities (
      session_id,
      activity_type,
      amount_minor,
      running_balance_minor,
      order_id,
      notes,
      created_by
    )
    VALUES (
      p_register_session_id,
      'CASH_SALE',
      v_total_minor,
      (SELECT expected_cash_minor FROM public.register_sessions WHERE id = p_register_session_id),
      v_order_id,
      'POS cash sale #' || v_order_number,
      v_staff_id
    );
  END IF;

  -- 7. Advance order to PROCESSING then DELIVERED immediately (customer takes items)
  UPDATE public.orders
  SET status = 'PROCESSING', updated_at = now()
  WHERE id = v_order_id;

  INSERT INTO public.order_status_history (
    order_id, from_status, to_status, source, changed_by, idempotency_key, note
  )
  VALUES (
    v_order_id, 'CONFIRMED', 'PROCESSING', 'pos_terminal', v_staff_id,
    'hist_proc_' || v_idempotency, 'POS items prepared at counter'
  );

  UPDATE public.orders
  SET status = 'DELIVERED', updated_at = now()
  WHERE id = v_order_id;

  INSERT INTO public.order_status_history (
    order_id, from_status, to_status, source, changed_by, idempotency_key, note
  )
  VALUES (
    v_order_id, 'PROCESSING', 'DELIVERED', 'pos_terminal', v_staff_id,
    'hist_deliv_' || v_idempotency, 'POS items handed to customer at counter'
  );

  -- 8. Audit log
  INSERT INTO public.audit_logs (
    actor_id,
    actor_role,
    action,
    entity,
    entity_id,
    new_values
  )
  VALUES (
    v_staff_id,
    'admin',
    'pos_sale_completed',
    'orders',
    v_order_id,
    jsonb_build_object(
      'order_number', v_order_number,
      'total_minor', v_total_minor,
      'payment_method', p_payment_method,
      'tendered_minor', p_tendered_minor,
      'change_minor', v_change_minor
    )
  );

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'total_minor', v_total_minor,
    'tendered_minor', p_tendered_minor,
    'change_minor', v_change_minor,
    'status', 'DELIVERED'
  );
END;
$$;

-- D. Create Customer Return Request
CREATE OR REPLACE FUNCTION public.create_customer_return_request(
  p_order_id UUID,
  p_type TEXT,
  p_reason TEXT,
  p_reason_details TEXT,
  p_requested_refund_minor BIGINT,
  p_exchange_variant_id UUID DEFAULT NULL,
  p_proof_paths TEXT[] DEFAULT '{}'
)
RETURNS public.return_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_order public.orders;
  v_return public.return_requests;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = '42501';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found or not owned by user' USING errcode = 'P0002';
  END IF;

  IF v_order.status NOT IN ('DELIVERED', 'COMPLETED') THEN
    RAISE EXCEPTION 'return requests can only be made for delivered orders' USING errcode = '23514';
  END IF;

  IF p_requested_refund_minor > v_order.total_minor THEN
    RAISE EXCEPTION 'requested refund exceeds order total' USING errcode = '23514';
  END IF;

  INSERT INTO public.return_requests (
    order_id,
    user_id,
    type,
    status,
    reason,
    reason_details,
    exchange_variant_id,
    requested_refund_minor,
    proof_storage_paths
  )
  VALUES (
    p_order_id,
    v_user_id,
    p_type,
    'REQUESTED',
    p_reason,
    p_reason_details,
    p_exchange_variant_id,
    p_requested_refund_minor,
    p_proof_paths
  )
  RETURNING * INTO v_return;

  INSERT INTO public.audit_logs (
    actor_id,
    actor_role,
    action,
    entity,
    entity_id,
    new_values
  )
  VALUES (
    v_user_id,
    'customer',
    'return_requested',
    'return_requests',
    v_return.id,
    jsonb_build_object(
      'order_id', p_order_id,
      'type', p_type,
      'reason', p_reason,
      'requested_refund_minor', p_requested_refund_minor
    )
  );

  RETURN v_return;
END;
$$;

-- E. Admin Process Return Request
CREATE OR REPLACE FUNCTION public.admin_process_return_request(
  p_return_id UUID,
  p_decision TEXT,
  p_approved_refund_minor BIGINT DEFAULT 0,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS public.return_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_return public.return_requests;
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = '42501';
  END IF;

  IF NOT (private.has_role('admin') OR private.has_role('super_admin')) THEN
    RAISE EXCEPTION 'admin role required' USING errcode = '42501';
  END IF;

  IF p_decision NOT IN ('APPROVED', 'REJECTED', 'ITEMS_RECEIVED', 'COMPLETED') THEN
    RAISE EXCEPTION 'invalid decision status' USING errcode = '23514';
  END IF;

  SELECT * INTO v_return
  FROM public.return_requests
  WHERE id = p_return_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'return request not found' USING errcode = 'P0002';
  END IF;

  UPDATE public.return_requests
  SET
    status = p_decision,
    approved_refund_minor = coalesce(p_approved_refund_minor, approved_refund_minor),
    admin_notes = coalesce(p_admin_notes, admin_notes),
    updated_at = now()
  WHERE id = p_return_id
  RETURNING * INTO v_return;

  INSERT INTO public.audit_logs (
    actor_id,
    actor_role,
    action,
    entity,
    entity_id,
    new_values
  )
  VALUES (
    v_admin_id,
    'admin',
    'return_' || lower(p_decision),
    'return_requests',
    p_return_id,
    jsonb_build_object(
      'decision', p_decision,
      'approved_refund_minor', p_approved_refund_minor,
      'notes', p_admin_notes
    )
  );

  RETURN v_return;
END;
$$;

-- F. Admin Issue Refund
CREATE OR REPLACE FUNCTION public.admin_issue_refund(
  p_order_id UUID,
  p_amount_minor BIGINT,
  p_method TEXT,
  p_reason TEXT,
  p_return_request_id UUID DEFAULT NULL,
  p_reference_number TEXT DEFAULT NULL
)
RETURNS public.refunds
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_payment public.payments;
  v_refund public.refunds;
  v_total_refunded BIGINT := 0;
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = '42501';
  END IF;

  IF NOT (private.has_role('admin') OR private.has_role('super_admin')) THEN
    RAISE EXCEPTION 'admin role required' USING errcode = '42501';
  END IF;

  IF p_amount_minor <= 0 THEN
    RAISE EXCEPTION 'refund amount must be greater than zero' USING errcode = '23514';
  END IF;

  SELECT * INTO v_payment
  FROM public.payments
  WHERE order_id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment record not found' USING errcode = 'P0002';
  END IF;

  IF v_payment.status NOT IN ('PAID', 'REFUND_PENDING', 'PARTIALLY_REFUNDED') THEN
    RAISE EXCEPTION 'payment is not in a refundable state: %', v_payment.status USING errcode = '23514';
  END IF;

  SELECT coalesce(sum(amount_minor), 0) INTO v_total_refunded
  FROM public.refunds
  WHERE payment_id = v_payment.id AND status = 'COMPLETED';

  IF (v_total_refunded + p_amount_minor) > v_payment.amount_minor THEN
    RAISE EXCEPTION 'refund amount exceeds remaining paid balance' USING errcode = '23514';
  END IF;

  INSERT INTO public.refunds (
    payment_id,
    order_id,
    return_request_id,
    amount_minor,
    status,
    method,
    reference_number,
    reason,
    processed_by
  )
  VALUES (
    v_payment.id,
    p_order_id,
    p_return_request_id,
    p_amount_minor,
    'COMPLETED',
    p_method,
    p_reference_number,
    p_reason,
    v_admin_id
  )
  RETURNING * INTO v_refund;

  -- Update payment status accordingly
  IF (v_total_refunded + p_amount_minor) = v_payment.amount_minor THEN
    UPDATE public.payments
    SET status = 'REFUNDED', updated_at = now()
    WHERE id = v_payment.id;
  ELSE
    UPDATE public.payments
    SET status = 'PARTIALLY_REFUNDED', updated_at = now()
    WHERE id = v_payment.id;
  END IF;

  -- Record payment event for auditability
  INSERT INTO public.payment_events (
    payment_id,
    event_type,
    from_status,
    to_status,
    actor_id,
    reason,
    idempotency_key,
    metadata
  ) VALUES (
    v_payment.id,
    'REFUND_PROCESSED',
    v_payment.status,
    CASE WHEN (v_total_refunded + p_amount_minor) = v_payment.amount_minor THEN 'REFUNDED' ELSE 'PARTIALLY_REFUNDED' END,
    v_admin_id,
    p_reason,
    'refund:' || v_refund.id::TEXT,
    jsonb_build_object('refund_id', v_refund.id, 'amount_minor', p_amount_minor, 'reference_number', p_reference_number)
  );

  -- If return request linked, update it to COMPLETED
  IF p_return_request_id IS NOT NULL THEN
    UPDATE public.return_requests
    SET status = 'COMPLETED', updated_at = now()
    WHERE id = p_return_request_id;
  END IF;

  INSERT INTO public.audit_logs (
    actor_id,
    actor_role,
    action,
    entity,
    entity_id,
    new_values
  )
  VALUES (
    v_admin_id,
    'admin',
    'refund_issued',
    'refunds',
    v_refund.id,
    jsonb_build_object(
      'order_id', p_order_id,
      'amount_minor', p_amount_minor,
      'method', p_method,
      'reason', p_reason
    )
  );

  RETURN v_refund;
END;
$$;

-- G. Admin Create Shipment with Tracking
CREATE OR REPLACE FUNCTION public.admin_create_shipment(
  p_order_id UUID,
  p_provider TEXT,
  p_tracking_number TEXT,
  p_carrier_notes TEXT DEFAULT NULL
)
RETURNS public.shipments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_order public.orders;
  v_shipment public.shipments;
  v_tracking_url TEXT := NULL;
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = '42501';
  END IF;

  IF NOT (private.has_role('admin') OR private.has_role('super_admin')) THEN
    RAISE EXCEPTION 'admin role required' USING errcode = '42501';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found' USING errcode = 'P0002';
  END IF;

  IF p_provider NOT IN ('MANUAL', 'LBC', 'JNT', 'J&T', 'GOGO', 'OTHER') THEN
    RAISE EXCEPTION 'unsupported courier provider' USING errcode = '23514';
  END IF;

  -- Derive tracking URL if known provider template
  IF (p_provider = 'JNT' OR p_provider = 'J&T') AND p_tracking_number IS NOT NULL THEN
    v_tracking_url := 'https://www.jtexpress.ph/trajectoryQuery?bills=' || p_tracking_number;
  ELSIF p_provider = 'LBC' AND p_tracking_number IS NOT NULL THEN
    v_tracking_url := 'https://www.lbcexpress.com/track/?tracking_no=' || p_tracking_number;
  ELSIF p_provider = 'GOGO' AND p_tracking_number IS NOT NULL THEN
    v_tracking_url := 'https://app.gogoxpress.com/track/' || p_tracking_number;
  END IF;

  INSERT INTO public.shipments (
    order_id,
    provider,
    tracking_number,
    tracking_url,
    carrier_notes,
    shipped_at,
    status
  )
  VALUES (
    p_order_id,
    p_provider,
    p_tracking_number,
    v_tracking_url,
    p_carrier_notes,
    now(),
    'SHIPPED'
  )
  RETURNING * INTO v_shipment;

  -- If order was READY_FOR_SHIPMENT or PACKING or PROCESSING, advance to SHIPPED
  IF v_order.status IN ('READY_FOR_SHIPMENT', 'PACKING', 'PROCESSING') THEN
    UPDATE public.orders
    SET status = 'SHIPPED', updated_at = now()
    WHERE id = p_order_id;

    INSERT INTO public.order_status_history (
      order_id, from_status, to_status, source, changed_by, idempotency_key, note
    )
    VALUES (
      p_order_id, v_order.status, 'SHIPPED', 'shipment_creation', v_admin_id,
      'ship_hist_' || gen_random_uuid()::text,
      'Dispatched via ' || p_provider || coalesce(' (Tracking #' || p_tracking_number || ')', '')
    );
  END IF;

  INSERT INTO public.audit_logs (
    actor_id,
    actor_role,
    action,
    entity,
    entity_id,
    new_values
  )
  VALUES (
    v_admin_id,
    'admin',
    'shipment_created',
    'shipments',
    v_shipment.id,
    jsonb_build_object(
      'order_id', p_order_id,
      'provider', p_provider,
      'tracking_number', p_tracking_number
    )
  );

  RETURN v_shipment;
END;
$$;

-- H. Enhanced checkout_order supporting Cash payment at Store Pickup
CREATE OR REPLACE FUNCTION public.checkout_order(
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
  v_fulfillment_method TEXT := 'SHIPMENT';
BEGIN
  IF p_customer_id IS NULL
     OR p_idempotency_key IS NULL
     OR pg_catalog.btrim(p_idempotency_key, E' \t\n\r') = ''
     OR pg_catalog.length(p_idempotency_key) > 128
     OR p_lines IS NULL OR pg_catalog.jsonb_typeof(p_lines) <> 'array'
     OR pg_catalog.jsonb_array_length(p_lines) NOT BETWEEN 1 AND 100
     OR pg_catalog.pg_column_size(p_lines) > 65536
     OR p_shipping_minor IS NULL OR p_shipping_minor < 0
     OR p_payment_method NOT IN ('COD', 'MANUAL_GCASH', 'CASH')
     OR p_delivery IS NULL OR pg_catalog.jsonb_typeof(p_delivery) <> 'object'
     OR pg_catalog.pg_column_size(p_delivery) > 16384
     OR (p_payment_method = 'MANUAL_GCASH' AND p_gcash_expires_at IS NULL)
     OR (p_payment_method IN ('COD', 'CASH') AND p_gcash_expires_at IS NOT NULL)
     OR (p_payment_method = 'CASH' AND p_shipping_minor <> 0)
     OR (p_customer_note IS NOT NULL AND pg_catalog.btrim(p_customer_note) = '') THEN
    RAISE EXCEPTION 'invalid checkout input' USING ERRCODE = '22023';
  END IF;

  IF p_payment_method = 'CASH' OR p_shipping_minor = 0 THEN
    v_fulfillment_method := 'STORE_PICKUP';
  ELSE
    v_fulfillment_method := 'SHIPMENT';
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
        city_municipality, province, postal_code, country_code, customer_note,
        sales_channel, fulfillment_method
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
        coalesce(p_delivery ->> 'country_code', 'PH'), p_customer_note,
        'STOREFRONT', v_fulfillment_method
      ) RETURNING * INTO v_order;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
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
    IF p_payment_method IN ('COD', 'CASH') THEN
      PERFORM private.transition_inventory_reservation(
        v_reservation_id, 'consumed',
        'checkout-consume:' || pg_catalog.md5(p_idempotency_key || ':' || v_line.variant_id::TEXT),
        p_customer_id, p_payment_method || ' order accepted'
      );
    END IF;
  END LOOP;

  INSERT INTO public.audit_logs (actor_id, actor_role, action, entity, entity_id, new_values)
  VALUES (
    p_customer_id, 'customer', 'order.checked_out', 'order', v_order.id,
    pg_catalog.jsonb_build_object(
      'payment_method', p_payment_method, 'total_minor', v_order.total_minor,
      'fulfillment_method', v_fulfillment_method,
      'gcash_expires_at', p_gcash_expires_at
    )
  );

  RETURN v_order;
END;
$$;

-- I. Admin Settle Pickup Payment (counter cash collection upon Store Pickup)
CREATE OR REPLACE FUNCTION public.admin_settle_pickup_payment(
  p_order_id UUID,
  p_register_session_id UUID DEFAULT NULL,
  p_tendered_minor BIGINT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_staff_id UUID := auth.uid();
  v_order public.orders;
  v_payment public.payments;
  v_tendered BIGINT;
  v_change BIGINT := 0;
BEGIN
  IF v_staff_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = '42501';
  END IF;

  IF NOT (
    private.has_role('cashier')
    OR private.has_role('admin')
    OR private.has_role('super_admin')
  ) THEN
    RAISE EXCEPTION 'insufficient role to settle pickup payment' USING errcode = '42501';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found' USING errcode = 'P0002';
  END IF;

  IF v_order.fulfillment_method <> 'STORE_PICKUP' THEN
    RAISE EXCEPTION 'order is not a store pickup order' USING errcode = '23514';
  END IF;

  SELECT * INTO v_payment
  FROM public.payments
  WHERE order_id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment record not found' USING errcode = 'P0002';
  END IF;

  IF v_payment.method <> 'CASH' THEN
    RAISE EXCEPTION 'payment method is not CASH' USING errcode = '23514';
  END IF;

  IF v_payment.status <> 'UNPAID' THEN
    RAISE EXCEPTION 'payment is not UNPAID' USING errcode = '23514';
  END IF;

  v_tendered := coalesce(p_tendered_minor, v_order.total_minor);
  IF v_tendered < v_order.total_minor THEN
    RAISE EXCEPTION 'tendered cash amount is less than order total' USING errcode = '23514';
  END IF;
  v_change := v_tendered - v_order.total_minor;

  -- Settle payment to PAID
  UPDATE public.payments
  SET status = 'PAID', paid_at = now(), updated_at = now()
  WHERE id = v_payment.id;

  INSERT INTO public.payment_events (
    payment_id, event_type, from_status, to_status, actor_id, reason, idempotency_key, metadata
  )
  VALUES (
    v_payment.id, 'PAYMENT_PAID', 'UNPAID', 'PAID', v_staff_id,
    'Store pickup cash payment collected at counter',
    'settle_pickup_' || gen_random_uuid()::text,
    jsonb_build_object('tendered_minor', v_tendered, 'change_minor', v_change)
  );

  -- If register session provided, update expected cash and log activity
  IF p_register_session_id IS NOT NULL THEN
    UPDATE public.register_sessions
    SET expected_cash_minor = expected_cash_minor + v_order.total_minor,
        updated_at = now()
    WHERE id = p_register_session_id;

    INSERT INTO public.register_session_activities (
      session_id, activity_type, amount_minor, running_balance_minor,
      order_id, notes, created_by
    )
    VALUES (
      p_register_session_id, 'CASH_SALE', v_order.total_minor,
      (SELECT expected_cash_minor FROM public.register_sessions WHERE id = p_register_session_id),
      p_order_id,
      'Store pickup cash collected for Order #' || v_order.order_number,
      v_staff_id
    );
  END IF;

  -- Transition order to DELIVERED (customer received items)
  IF v_order.status IN ('CONFIRMED', 'PROCESSING') THEN
    UPDATE public.orders
    SET status = 'DELIVERED', updated_at = now()
    WHERE id = p_order_id;

    INSERT INTO public.order_status_history (
      order_id, from_status, to_status, source, changed_by, idempotency_key, note
    )
    VALUES (
      p_order_id, v_order.status, 'DELIVERED', 'store_pickup_counter', v_staff_id,
      'hist_pickup_' || gen_random_uuid()::text,
      'Order collected and handed over at flagship store counter'
    );
  END IF;

  INSERT INTO public.audit_logs (
    actor_id, actor_role, action, entity, entity_id, new_values
  )
  VALUES (
    v_staff_id, 'admin', 'store_pickup_settled', 'orders', p_order_id,
    jsonb_build_object(
      'order_id', p_order_id,
      'total_minor', v_order.total_minor,
      'tendered_minor', v_tendered,
      'change_minor', v_change
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'total_minor', v_order.total_minor,
    'tendered_minor', v_tendered,
    'change_minor', v_change,
    'payment_status', 'PAID',
    'order_status', 'DELIVERED'
  );
END;
$$;

-- J. Cancel Order Before Shipment (releasing active reservations or restocking consumed items)
CREATE OR REPLACE FUNCTION public.cancel_order(
  p_order_id UUID,
  p_reason TEXT DEFAULT 'Cancelled before shipment'
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_order public.orders;
  v_payment public.payments;
  v_res RECORD;
  v_is_staff BOOLEAN := false;
  v_is_owner BOOLEAN := false;
  v_from_status TEXT;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = '42501';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found' USING errcode = 'P0002';
  END IF;

  v_is_owner := (v_order.user_id = v_actor_id);
  v_is_staff := (private.has_role('admin') OR private.has_role('super_admin') OR private.has_role('cashier'));

  IF NOT (v_is_owner OR v_is_staff) THEN
    RAISE EXCEPTION 'unauthorized to cancel order' USING errcode = '42501';
  END IF;

  -- Only permitted before shipment/delivery
  IF v_order.status NOT IN ('CONFIRMED', 'PROCESSING', 'PACKING', 'READY_FOR_SHIPMENT') THEN
    RAISE EXCEPTION 'cannot cancel order in status: %', v_order.status USING errcode = '23514';
  END IF;

  -- 1. Inventory release or restock
  -- For active reservations: release them
  FOR v_res IN
    SELECT * FROM public.inventory_reservations
    WHERE order_id = p_order_id AND status = 'active'
  LOOP
    PERFORM private.transition_inventory_reservation(
      v_res.id,
      'released',
      'cancel_rel_' || v_res.id::text,
      v_actor_id,
      coalesce(p_reason, 'Order cancelled before shipment')
    );
  END LOOP;

  -- For consumed reservations: restock on_hand
  FOR v_res IN
    SELECT * FROM public.inventory_reservations
    WHERE order_id = p_order_id AND status = 'consumed'
  LOOP
    UPDATE public.inventory
    SET on_hand = on_hand + v_res.quantity
    WHERE variant_id = v_res.variant_id;

    INSERT INTO public.inventory_movements (
      variant_id, movement_type, on_hand_delta, reserved_delta,
      on_hand_after, reserved_after, reservation_id, actor_id,
      idempotency_key, reason
    )
    VALUES (
      v_res.variant_id, 'restock', v_res.quantity, 0,
      (SELECT on_hand FROM public.inventory WHERE variant_id = v_res.variant_id),
      (SELECT reserved FROM public.inventory WHERE variant_id = v_res.variant_id),
      NULL, v_actor_id,
      'cancel_restock_' || v_res.id::text,
      coalesce(p_reason, 'Order cancelled before shipment restock')
    );
  END LOOP;

  -- 2. Payment transition
  SELECT * INTO v_payment
  FROM public.payments
  WHERE order_id = p_order_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_payment.status = 'PAID' THEN
      UPDATE public.payments
      SET status = 'REFUND_PENDING', updated_at = now()
      WHERE id = v_payment.id;

      INSERT INTO public.payment_events (
        payment_id, event_type, from_status, to_status, actor_id, reason, idempotency_key
      )
      VALUES (
        v_payment.id, 'REFUND_PROCESSED', 'PAID', 'REFUND_PENDING', v_actor_id,
        'Order cancelled by ' || CASE WHEN v_is_owner THEN 'customer' ELSE 'staff' END,
        'cancel_pay_' || gen_random_uuid()::text
      );
    ELSIF v_payment.status IN ('UNPAID', 'SUBMITTED', 'VERIFYING') THEN
      UPDATE public.payments
      SET status = 'FAILED', updated_at = now()
      WHERE id = v_payment.id;

      INSERT INTO public.payment_events (
        payment_id, event_type, from_status, to_status, actor_id, reason, idempotency_key
      )
      VALUES (
        v_payment.id, 'PAYMENT_FAILED', v_payment.status, 'FAILED', v_actor_id,
        'Order cancelled by ' || CASE WHEN v_is_owner THEN 'customer' ELSE 'staff' END,
        'cancel_pay_' || gen_random_uuid()::text
      );
    END IF;
  END IF;

  v_from_status := v_order.status;

  -- 3. Order status transition
  UPDATE public.orders
  SET status = 'CANCELLED',
      cancellation_reason = coalesce(p_reason, 'Cancelled before shipment'),
      updated_at = now()
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  INSERT INTO public.order_status_history (
    order_id, from_status, to_status, source, changed_by, idempotency_key, note
  )
  VALUES (
    p_order_id, v_from_status, 'CANCELLED',
    CASE WHEN v_is_owner THEN 'customer' ELSE 'staff' END,
    v_actor_id,
    'cancel_hist_' || gen_random_uuid()::text,
    coalesce(p_reason, 'Cancelled before shipment')
  );

  INSERT INTO public.audit_logs (
    actor_id, actor_role, action, entity, entity_id, new_values
  )
  VALUES (
    v_actor_id,
    CASE WHEN v_is_staff THEN 'admin' ELSE 'customer' END,
    'order_cancelled', 'orders', p_order_id,
    jsonb_build_object('order_id', p_order_id, 'reason', p_reason)
  );

  RETURN v_order;
END;
$$;

-- K. Admin Process Exchange with Server-Calculated Price Difference
CREATE OR REPLACE FUNCTION public.admin_process_exchange(
  p_order_id UUID,
  p_orig_variant_id UUID,
  p_new_variant_id UUID,
  p_reason TEXT,
  p_register_session_id UUID DEFAULT NULL,
  p_cash_tendered_minor BIGINT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_staff_id UUID := auth.uid();
  v_order public.orders;
  v_payment public.payments;
  v_orig_item public.order_items;
  v_new_variant public.product_variants;
  v_new_product public.products;
  v_orig_variant public.product_variants;
  v_new_inv public.inventory;
  v_price_diff BIGINT;
  v_balance_due BIGINT := 0;
  v_refund_due BIGINT := 0;
  v_change BIGINT := 0;
  v_running_bal BIGINT;
  v_refund_id UUID := NULL;
BEGIN
  IF v_staff_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = '42501';
  END IF;

  IF NOT (
    private.has_role('cashier')
    OR private.has_role('admin')
    OR private.has_role('super_admin')
  ) THEN
    RAISE EXCEPTION 'insufficient role for processing exchange' USING errcode = '42501';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found' USING errcode = 'P0002';
  END IF;

  IF v_order.status IN ('CANCELLED', 'DELIVERY_FAILED') THEN
    RAISE EXCEPTION 'cannot exchange items for cancelled order' USING errcode = '23514';
  END IF;

  -- Check original item in order
  SELECT * INTO v_orig_item
  FROM public.order_items
  WHERE order_id = p_order_id AND variant_id = p_orig_variant_id
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'original variant not in order items' USING errcode = 'P0002';
  END IF;

  SELECT * INTO v_orig_variant
  FROM public.product_variants
  WHERE id = p_orig_variant_id;

  -- Check replacement variant
  SELECT * INTO v_new_variant
  FROM public.product_variants
  WHERE id = p_new_variant_id;

  IF NOT FOUND OR v_new_variant.status <> 'active' THEN
    RAISE EXCEPTION 'replacement variant not found or inactive' USING errcode = '23514';
  END IF;

  SELECT * INTO v_new_product
  FROM public.products
  WHERE id = v_new_variant.product_id;

  -- Lock and verify stock for replacement variant
  SELECT * INTO v_new_inv
  FROM public.inventory
  WHERE variant_id = p_new_variant_id
  FOR UPDATE;

  IF NOT FOUND OR (v_new_inv.on_hand - v_new_inv.reserved) < 1 THEN
    RAISE EXCEPTION 'insufficient inventory for replacement variant %', v_new_variant.sku USING errcode = '23514';
  END IF;

  -- 1. Restock 1 original variant
  UPDATE public.inventory
  SET on_hand = on_hand + 1
  WHERE variant_id = p_orig_variant_id;

  INSERT INTO public.inventory_movements (
    variant_id, movement_type, on_hand_delta, reserved_delta,
    on_hand_after, reserved_after, actor_id, idempotency_key, reason
  )
  VALUES (
    p_orig_variant_id, 'restock', 1, 0,
    (SELECT on_hand FROM public.inventory WHERE variant_id = p_orig_variant_id),
    (SELECT reserved FROM public.inventory WHERE variant_id = p_orig_variant_id),
    v_staff_id, 'exch_restock_' || gen_random_uuid()::text,
    'Exchanged return for order #' || v_order.order_number
  );

  -- 2. Deduct 1 replacement variant
  UPDATE public.inventory
  SET on_hand = on_hand - 1
  WHERE variant_id = p_new_variant_id;

  INSERT INTO public.inventory_movements (
    variant_id, movement_type, on_hand_delta, reserved_delta,
    on_hand_after, reserved_after, actor_id, idempotency_key, reason
  )
  VALUES (
    p_new_variant_id, 'adjustment', -1, 0,
    (SELECT on_hand FROM public.inventory WHERE variant_id = p_new_variant_id),
    (SELECT reserved FROM public.inventory WHERE variant_id = p_new_variant_id),
    v_staff_id, 'exch_out_' || gen_random_uuid()::text,
    'Exchanged fulfillment for order #' || v_order.order_number
  );

  -- 3. Calculate price difference: new_price - orig_price
  v_price_diff := v_new_variant.price_minor - v_orig_item.unit_price_minor;

  SELECT * INTO v_payment
  FROM public.payments
  WHERE order_id = p_order_id
  FOR UPDATE;

  IF v_price_diff = 0 THEN
    -- Even swap
    v_balance_due := 0;
    v_refund_due := 0;
    v_change := 0;

  ELSIF v_price_diff > 0 THEN
    -- Balance due: customer pays extra
    v_balance_due := v_price_diff;
    v_refund_due := 0;

    IF p_register_session_id IS NOT NULL THEN
      IF p_cash_tendered_minor < v_balance_due THEN
        RAISE EXCEPTION 'cash tendered (% centavos) less than balance due (% centavos)',
          p_cash_tendered_minor, v_balance_due USING errcode = '23514';
      END IF;
      v_change := p_cash_tendered_minor - v_balance_due;

      UPDATE public.register_sessions
      SET expected_cash_minor = expected_cash_minor + v_balance_due,
          updated_at = now()
      WHERE id = p_register_session_id;

      SELECT expected_cash_minor INTO v_running_bal
      FROM public.register_sessions WHERE id = p_register_session_id;

      INSERT INTO public.register_session_activities (
        session_id, activity_type, amount_minor, running_balance_minor,
        order_id, notes, created_by
      )
      VALUES (
        p_register_session_id, 'EXCHANGE_BALANCE_COLLECTED', v_balance_due, v_running_bal,
        p_order_id, 'Exchange balance collected: ' || v_orig_variant.sku || ' -> ' || v_new_variant.sku,
        v_staff_id
      );
    END IF;

    -- Update order totals
    UPDATE public.orders
    SET subtotal_minor = subtotal_minor + v_balance_due,
        total_minor = total_minor + v_balance_due,
        updated_at = now()
    WHERE id = p_order_id;

    IF FOUND AND v_payment.id IS NOT NULL THEN
      UPDATE public.payments
      SET amount_minor = amount_minor + v_balance_due,
          updated_at = now()
      WHERE id = v_payment.id;
    END IF;

  ELSE
    -- Refund due: customer receives money back
    v_balance_due := 0;
    v_refund_due := abs(v_price_diff);
    v_change := 0;

    -- Insert refund record
    INSERT INTO public.refunds (
      payment_id, order_id, amount_minor, status, method, reason, processed_by
    )
    VALUES (
      v_payment.id, p_order_id, v_refund_due, 'COMPLETED',
      CASE WHEN p_register_session_id IS NOT NULL THEN 'CASH' ELSE 'MANUAL_GCASH' END,
      'Exchange price difference refund: ' || v_orig_variant.sku || ' -> ' || v_new_variant.sku,
      v_staff_id
    )
    RETURNING id INTO v_refund_id;

    -- Update payment status to PARTIALLY_REFUNDED
    UPDATE public.payments
    SET status = 'PARTIALLY_REFUNDED', updated_at = now()
    WHERE id = v_payment.id;

    IF p_register_session_id IS NOT NULL THEN
      UPDATE public.register_sessions
      SET expected_cash_minor = expected_cash_minor - v_refund_due,
          updated_at = now()
      WHERE id = p_register_session_id;

      SELECT expected_cash_minor INTO v_running_bal
      FROM public.register_sessions WHERE id = p_register_session_id;

      INSERT INTO public.register_session_activities (
        session_id, activity_type, amount_minor, running_balance_minor,
        order_id, reference_id, notes, created_by
      )
      VALUES (
        p_register_session_id, 'EXCHANGE_REFUND_PAID', -v_refund_due, v_running_bal,
        p_order_id, v_refund_id,
        'Exchange refund paid: ' || v_orig_variant.sku || ' -> ' || v_new_variant.sku,
        v_staff_id
      );
    END IF;

    -- Update order totals
    UPDATE public.orders
    SET subtotal_minor = subtotal_minor - v_refund_due,
        total_minor = total_minor - v_refund_due,
        updated_at = now()
    WHERE id = p_order_id;
  END IF;

  -- 4. Update order line item to replacement variant
  IF v_orig_item.quantity = 1 THEN
    UPDATE public.order_items
    SET variant_id = v_new_variant.id,
        product_id = v_new_product.id,
        product_name = v_new_product.name,
        variant_name = v_new_variant.name,
        sku = v_new_variant.sku,
        unit_price_minor = v_new_variant.price_minor,
        line_subtotal_minor = v_new_variant.price_minor,
        line_total_minor = v_new_variant.price_minor
    WHERE id = v_orig_item.id;
  ELSE
    UPDATE public.order_items
    SET quantity = quantity - 1,
        line_subtotal_minor = unit_price_minor * (quantity - 1),
        line_total_minor = unit_price_minor * (quantity - 1)
    WHERE id = v_orig_item.id;

    INSERT INTO public.order_items (
      order_id, product_id, variant_id, product_name, variant_name, sku,
      selected_options, quantity, unit_price_minor, unit_discount_minor,
      line_subtotal_minor, line_discount_minor, line_total_minor
    )
    VALUES (
      p_order_id, v_new_product.id, v_new_variant.id, v_new_product.name,
      v_new_variant.name, v_new_variant.sku, '{}'::jsonb, 1,
      v_new_variant.price_minor, 0, v_new_variant.price_minor, 0, v_new_variant.price_minor
    );
  END IF;

  -- 5. Status history & audit log
  INSERT INTO public.order_status_history (
    order_id, from_status, to_status, source, changed_by, idempotency_key, note
  )
  VALUES (
    p_order_id, v_order.status, v_order.status, 'admin_exchange', v_staff_id,
    'exch_hist_' || gen_random_uuid()::text,
    'Item exchanged: ' || v_orig_variant.sku || ' replaced by ' || v_new_variant.sku ||
    CASE
      WHEN v_price_diff > 0 THEN ' (Balance collected: ₱' || (v_balance_due/100.0)::text || ')'
      WHEN v_price_diff < 0 THEN ' (Refund issued: ₱' || (v_refund_due/100.0)::text || ')'
      ELSE ' (Even size swap)'
    END
  );

  INSERT INTO public.audit_logs (
    actor_id, actor_role, action, entity, entity_id, new_values
  )
  VALUES (
    v_staff_id, 'admin', 'item_exchange_processed', 'orders', p_order_id,
    jsonb_build_object(
      'orig_variant_id', p_orig_variant_id,
      'orig_sku', v_orig_variant.sku,
      'new_variant_id', p_new_variant_id,
      'new_sku', v_new_variant.sku,
      'price_diff_minor', v_price_diff,
      'balance_due_minor', v_balance_due,
      'refund_due_minor', v_refund_due,
      'reason', p_reason
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'price_diff_minor', v_price_diff,
    'balance_due_minor', v_balance_due,
    'refund_due_minor', v_refund_due,
    'change_minor', v_change,
    'orig_sku', v_orig_variant.sku,
    'new_sku', v_new_variant.sku
  );
END;
$$;

-- Normalize grants for all RPCs
GRANT EXECUTE ON FUNCTION public.open_register_session(BIGINT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.close_register_session(UUID, BIGINT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_pos_sale(JSONB, TEXT, BIGINT, TEXT, TEXT, TEXT, UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_customer_return_request(UUID, TEXT, TEXT, TEXT, BIGINT, UUID, TEXT[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_process_return_request(UUID, TEXT, BIGINT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_issue_refund(UUID, BIGINT, TEXT, TEXT, UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_create_shipment(UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_settle_pickup_payment(UUID, UUID, BIGINT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_order(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_process_exchange(UUID, UUID, UUID, TEXT, UUID, BIGINT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.checkout_order(UUID, TEXT, JSONB, BIGINT, TEXT, TIMESTAMPTZ, JSONB, TEXT) TO service_role, authenticated;
