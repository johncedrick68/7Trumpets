-- Defense-in-depth for authenticated Admin mutation RPCs and canonical courier storage.

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
    RAISE EXCEPTION 'unsupported role: %', required_role USING errcode = '22023';
  END IF;

  IF subject_id IS NULL THEN
    RETURN false;
  END IF;

  -- Admin authority is never valid at AAL1, including direct PostgREST RPC calls.
  IF required_role IN ('admin', 'super_admin')
     AND coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM private.user_roles AS ur
    WHERE ur.user_id = subject_id AND ur.role = required_role
  );
END;
$$;

REVOKE app_rls_role_reader FROM postgres;

UPDATE public.shipments SET provider = 'JNT' WHERE upper(btrim(provider)) = 'J&T';

ALTER TABLE public.shipments DROP CONSTRAINT IF EXISTS shipments_provider_check;
ALTER TABLE public.shipments
  ADD CONSTRAINT shipments_provider_check
  CHECK (provider IN ('MANUAL', 'LBC', 'JNT', 'GOGO', 'OTHER'));

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
  v_provider TEXT := upper(btrim(coalesce(p_provider, 'MANUAL')));
  v_provider_compact TEXT;
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = '42501';
  END IF;

  IF NOT (private.has_role('admin') OR private.has_role('super_admin')) THEN
    RAISE EXCEPTION 'admin role required with aal2' USING errcode = '42501';
  END IF;

  v_provider_compact := regexp_replace(v_provider, '[^A-Z0-9]', '', 'g');
  IF v_provider_compact IN ('JT', 'JNT') THEN
    v_provider := 'JNT';
  END IF;

  IF v_provider NOT IN ('MANUAL', 'LBC', 'JNT', 'GOGO', 'OTHER') THEN
    RAISE EXCEPTION 'unsupported courier provider' USING errcode = '23514';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found' USING errcode = 'P0002';
  END IF;

  IF v_provider = 'JNT' AND p_tracking_number IS NOT NULL THEN
    v_tracking_url := 'https://www.jtexpress.ph/track-and-trace?waybillNo=' || private.url_encode_component(p_tracking_number);
  ELSIF v_provider = 'LBC' AND p_tracking_number IS NOT NULL THEN
    v_tracking_url := 'https://www.lbcexpress.com/ph/track';
  ELSIF v_provider = 'GOGO' AND p_tracking_number IS NOT NULL THEN
    v_tracking_url := 'https://app.gogoxpress.com/track/' || private.url_encode_component(p_tracking_number);
  END IF;

  INSERT INTO public.shipments (
    order_id, provider, tracking_number, tracking_url, carrier_notes, shipped_at, status
  ) VALUES (
    p_order_id, v_provider, p_tracking_number, v_tracking_url, p_carrier_notes, now(), 'SHIPPED'
  ) RETURNING * INTO v_shipment;

  IF v_order.status IN ('READY_FOR_SHIPMENT', 'PACKING', 'PROCESSING') THEN
    UPDATE public.orders SET status = 'SHIPPED', updated_at = now() WHERE id = p_order_id;
    INSERT INTO public.order_status_history (
      order_id, from_status, to_status, source, changed_by, idempotency_key, note
    ) VALUES (
      p_order_id, v_order.status, 'SHIPPED', 'shipment_creation', v_admin_id,
      'ship_hist_' || gen_random_uuid()::text,
      'Dispatched via ' || v_provider || coalesce(' (Tracking #' || p_tracking_number || ')', '')
    );
  END IF;

  INSERT INTO public.audit_logs (actor_id, actor_role, action, entity, entity_id, new_values)
  VALUES (
    v_admin_id, 'admin', 'shipment_created', 'shipments', v_shipment.id,
    jsonb_build_object('order_id', p_order_id, 'provider', v_provider, 'tracking_number', p_tracking_number)
  );

  RETURN v_shipment;
END;
$$;

-- Normalize execute privileges for every authenticated sensitive Admin mutation RPC.
REVOKE ALL ON FUNCTION public.admin_create_shipment(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_process_return_request(UUID, TEXT, BIGINT, TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_issue_refund(UUID, BIGINT, TEXT, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_process_exchange(UUID, UUID, UUID, TEXT, UUID, BIGINT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_settle_pickup_payment(UUID, UUID, BIGINT, TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.open_register_session(BIGINT, TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.close_register_session(UUID, BIGINT, TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.create_pos_sale(JSONB, TEXT, BIGINT, TEXT, TEXT, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.admin_create_shipment(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_process_return_request(UUID, TEXT, BIGINT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_issue_refund(UUID, BIGINT, TEXT, TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_process_exchange(UUID, UUID, UUID, TEXT, UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_settle_pickup_payment(UUID, UUID, BIGINT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_register_session(BIGINT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_register_session(UUID, BIGINT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_pos_sale(JSONB, TEXT, BIGINT, TEXT, TEXT, TEXT, UUID, TEXT) TO authenticated;

-- Reassert least-privilege ACLs for the remaining sensitive Admin RPCs.
REVOKE ALL ON FUNCTION public.approve_gcash_submission(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.reject_gcash_submission(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.settle_cod_payment(UUID, TEXT, TEXT, JSONB) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.admin_transition_order(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.manage_user_role(UUID, TEXT, BOOLEAN) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.close_expired_gcash_payment(UUID, TEXT, TEXT) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.admin_save_category(UUID, TEXT, TEXT, TEXT, UUID, INTEGER, BOOLEAN) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.admin_save_product(UUID, UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.admin_save_variant(UUID, UUID, TEXT, TEXT, BIGINT, BIGINT, TEXT) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.admin_adjust_inventory(UUID, INTEGER, TEXT, TEXT, TEXT) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.admin_save_product_option(UUID, TEXT, UUID, INTEGER) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.admin_save_option_value(UUID, UUID, TEXT, UUID, INTEGER) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.admin_set_variant_option_value(UUID, UUID, UUID, UUID) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.admin_save_product_image(UUID, TEXT, TEXT, UUID, INTEGER) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.admin_delete_product_image(UUID) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.admin_reorder_product_image(UUID, TEXT) FROM PUBLIC, anon, service_role;
