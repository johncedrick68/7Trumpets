-- Use J&T Philippines' current Track & Trace route and encode tracking references.
-- This forward migration intentionally supersedes the legacy URL in the applied
-- domain expansion migration without rewriting migration history.

CREATE OR REPLACE FUNCTION private.url_encode_component(p_value TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = ''
AS $$
DECLARE
  v_bytes BYTEA := pg_catalog.convert_to(p_value, 'UTF8');
  v_result TEXT := '';
  v_byte INTEGER;
  v_index INTEGER;
BEGIN
  FOR v_index IN 0..pg_catalog.length(v_bytes) - 1 LOOP
    v_byte := pg_catalog.get_byte(v_bytes, v_index);
    IF (v_byte BETWEEN 48 AND 57)
      OR (v_byte BETWEEN 65 AND 90)
      OR (v_byte BETWEEN 97 AND 122)
      OR v_byte IN (45, 46, 95, 126)
    THEN
      v_result := v_result || pg_catalog.chr(v_byte);
    ELSE
      v_result := v_result || '%' || pg_catalog.upper(pg_catalog.lpad(pg_catalog.to_hex(v_byte), 2, '0'));
    END IF;
  END LOOP;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION private.url_encode_component(TEXT) FROM PUBLIC;

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

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found' USING errcode = 'P0002';
  END IF;

  IF p_provider NOT IN ('MANUAL', 'LBC', 'JNT', 'J&T', 'GOGO', 'OTHER') THEN
    RAISE EXCEPTION 'unsupported courier provider' USING errcode = '23514';
  END IF;

  IF (p_provider = 'JNT' OR p_provider = 'J&T') AND p_tracking_number IS NOT NULL THEN
    v_tracking_url := 'https://www.jtexpress.ph/track-and-trace?waybillNo=' || private.url_encode_component(p_tracking_number);
  ELSIF p_provider = 'LBC' AND p_tracking_number IS NOT NULL THEN
    v_tracking_url := 'https://www.lbcexpress.com/track/?tracking_no=' || private.url_encode_component(p_tracking_number);
  ELSIF p_provider = 'GOGO' AND p_tracking_number IS NOT NULL THEN
    v_tracking_url := 'https://app.gogoxpress.com/track/' || private.url_encode_component(p_tracking_number);
  END IF;

  INSERT INTO public.shipments (
    order_id, provider, tracking_number, tracking_url, carrier_notes, shipped_at, status
  ) VALUES (
    p_order_id, p_provider, p_tracking_number, v_tracking_url, p_carrier_notes, now(), 'SHIPPED'
  ) RETURNING * INTO v_shipment;

  IF v_order.status IN ('READY_FOR_SHIPMENT', 'PACKING', 'PROCESSING') THEN
    UPDATE public.orders SET status = 'SHIPPED', updated_at = now() WHERE id = p_order_id;
    INSERT INTO public.order_status_history (
      order_id, from_status, to_status, source, changed_by, idempotency_key, note
    ) VALUES (
      p_order_id, v_order.status, 'SHIPPED', 'shipment_creation', v_admin_id,
      'ship_hist_' || gen_random_uuid()::text,
      'Dispatched via ' || p_provider || coalesce(' (Tracking #' || p_tracking_number || ')', '')
    );
  END IF;

  INSERT INTO public.audit_logs (actor_id, actor_role, action, entity, entity_id, new_values)
  VALUES (
    v_admin_id, 'admin', 'shipment_created', 'shipments', v_shipment.id,
    jsonb_build_object('order_id', p_order_id, 'provider', p_provider, 'tracking_number', p_tracking_number)
  );

  RETURN v_shipment;
END;
$$;
