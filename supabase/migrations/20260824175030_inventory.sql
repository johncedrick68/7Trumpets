CREATE TABLE public.inventory (
  variant_id UUID PRIMARY KEY REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  on_hand INTEGER NOT NULL DEFAULT 0 CHECK (on_hand >= 0),
  reserved INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  safety_stock INTEGER NOT NULL DEFAULT 0 CHECK (safety_stock >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  CHECK (reserved + safety_stock <= on_hand)
);

CREATE TABLE public.inventory_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'consumed', 'released', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  terminal_at TIMESTAMPTZ,
  idempotency_key TEXT NOT NULL UNIQUE
    CHECK (pg_catalog.btrim(idempotency_key, E' \t\n\r') <> '' AND pg_catalog.length(idempotency_key) <= 128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  UNIQUE (variant_id, id),
  UNIQUE (order_id, variant_id),
  CHECK (
    (status = 'active' AND terminal_at IS NULL)
    OR (status <> 'active' AND terminal_at IS NOT NULL)
  )
);

CREATE TABLE public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  movement_type TEXT NOT NULL CHECK (movement_type IN (
    'reservation_created',
    'reservation_consumed',
    'reservation_released',
    'reservation_expired',
    'adjustment',
    'restock'
  )),
  on_hand_delta INTEGER NOT NULL DEFAULT 0,
  reserved_delta INTEGER NOT NULL DEFAULT 0,
  on_hand_after INTEGER NOT NULL CHECK (on_hand_after >= 0),
  reserved_after INTEGER NOT NULL CHECK (reserved_after >= 0),
  reservation_id UUID,
  order_item_id UUID REFERENCES public.order_items(id) ON DELETE RESTRICT,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  idempotency_key TEXT NOT NULL UNIQUE
    CHECK (pg_catalog.btrim(idempotency_key, E' \t\n\r') <> '' AND pg_catalog.length(idempotency_key) <= 128),
  reason TEXT CHECK (reason IS NULL OR (pg_catalog.btrim(reason, E' \t\n\r') <> '' AND pg_catalog.length(reason) <= 1000)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  CHECK (on_hand_delta <> 0 OR reserved_delta <> 0),
  CHECK (reserved_after <= on_hand_after),
  CHECK (
    (movement_type IN ('reservation_created', 'reservation_consumed', 'reservation_released', 'reservation_expired') AND reservation_id IS NOT NULL)
    OR (movement_type IN ('adjustment', 'restock') AND reservation_id IS NULL)
  ),
  FOREIGN KEY (variant_id, reservation_id)
    REFERENCES public.inventory_reservations(variant_id, id) ON DELETE RESTRICT
);

CREATE INDEX inventory_movements_variant_created_idx
  ON public.inventory_movements (variant_id, created_at DESC);

CREATE INDEX inventory_reservations_variant_status_idx
  ON public.inventory_reservations (variant_id, status);

CREATE INDEX inventory_reservations_active_expires_idx
  ON public.inventory_reservations (expires_at)
  WHERE status = 'active';

CREATE TRIGGER inventory_set_updated_at
BEFORE UPDATE ON public.inventory
FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER inventory_movements_append_only
BEFORE UPDATE OR DELETE ON public.inventory_movements
FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();

-- SECURITY DEFINER is required for the later service_role-only atomic stock operation.
CREATE FUNCTION private.reserve_inventory(
  p_order_id UUID,
  p_variant_id UUID,
  p_quantity INTEGER,
  p_expires_at TIMESTAMPTZ,
  p_idempotency_key TEXT,
  p_actor_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_inventory public.inventory%ROWTYPE;
  v_existing public.inventory_reservations%ROWTYPE;
  v_reservation_id UUID;
BEGIN
  IF p_order_id IS NULL OR p_variant_id IS NULL OR p_quantity IS NULL OR p_quantity <= 0
     OR p_expires_at IS NULL OR p_expires_at <= pg_catalog.now()
     OR p_idempotency_key IS NULL
     OR pg_catalog.btrim(p_idempotency_key, E' \t\n\r') = ''
     OR pg_catalog.length(p_idempotency_key) > 128 THEN
    RAISE EXCEPTION 'invalid inventory reservation input' USING ERRCODE = '22023';
  END IF;

  SELECT i.* INTO v_inventory
  FROM public.inventory AS i
  WHERE i.variant_id = p_variant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'inventory not found for variant %', p_variant_id USING ERRCODE = 'P0002';
  END IF;

  SELECT r.* INTO v_existing
  FROM public.inventory_reservations AS r
  WHERE r.idempotency_key = p_idempotency_key
     OR (r.order_id = p_order_id AND r.variant_id = p_variant_id)
  ORDER BY (r.idempotency_key = p_idempotency_key) DESC
  LIMIT 1;

  IF FOUND THEN
    IF v_existing.order_id = p_order_id
       AND v_existing.variant_id = p_variant_id
       AND v_existing.quantity = p_quantity
       AND v_existing.expires_at = p_expires_at
       AND v_existing.idempotency_key = p_idempotency_key
       AND EXISTS (
         SELECT 1 FROM public.inventory_movements AS m
         WHERE m.reservation_id = v_existing.id
           AND m.movement_type = 'reservation_created'
           AND m.idempotency_key = p_idempotency_key
           AND m.actor_id IS NOT DISTINCT FROM p_actor_id
       ) THEN
      RETURN v_existing.id;
    END IF;
    RAISE EXCEPTION 'conflicting inventory reservation retry' USING ERRCODE = '23505';
  END IF;

  IF v_inventory.on_hand - v_inventory.reserved - v_inventory.safety_stock < p_quantity THEN
    RAISE EXCEPTION 'insufficient available inventory for variant %', p_variant_id USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.inventory_reservations (
    order_id, variant_id, quantity, expires_at, idempotency_key
  ) VALUES (
    p_order_id, p_variant_id, p_quantity, p_expires_at, p_idempotency_key
  ) RETURNING id INTO v_reservation_id;

  UPDATE public.inventory
  SET reserved = reserved + p_quantity
  WHERE variant_id = p_variant_id
  RETURNING * INTO v_inventory;

  INSERT INTO public.inventory_movements (
    variant_id, movement_type, reserved_delta, on_hand_after, reserved_after,
    reservation_id, actor_id, idempotency_key
  ) VALUES (
    p_variant_id, 'reservation_created', p_quantity, v_inventory.on_hand,
    v_inventory.reserved, v_reservation_id, p_actor_id, p_idempotency_key
  );

  INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, new_values)
  VALUES (
    p_actor_id, 'inventory.reserved', 'inventory_reservation', v_reservation_id,
    pg_catalog.jsonb_build_object(
      'order_id', p_order_id, 'variant_id', p_variant_id,
      'quantity', p_quantity, 'status', 'active'
    )
  );

  RETURN v_reservation_id;
END;
$$;

ALTER FUNCTION private.reserve_inventory(UUID, UUID, INTEGER, TIMESTAMPTZ, TEXT, UUID) OWNER TO postgres;

-- SECURITY DEFINER keeps each terminal reservation and its stock movement atomic.
CREATE FUNCTION private.transition_inventory_reservation(
  p_reservation_id UUID,
  p_to_status TEXT,
  p_idempotency_key TEXT,
  p_actor_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_reservation public.inventory_reservations%ROWTYPE;
  v_inventory public.inventory%ROWTYPE;
  v_existing public.inventory_movements%ROWTYPE;
  v_on_hand_delta INTEGER;
  v_movement_type TEXT;
BEGIN
  IF p_reservation_id IS NULL
     OR p_to_status IS NULL OR p_to_status NOT IN ('consumed', 'released', 'expired')
     OR p_idempotency_key IS NULL
     OR pg_catalog.btrim(p_idempotency_key, E' \t\n\r') = ''
     OR pg_catalog.length(p_idempotency_key) > 128
     OR (p_reason IS NOT NULL AND (
       pg_catalog.btrim(p_reason, E' \t\n\r') = '' OR pg_catalog.length(p_reason) > 1000
     )) THEN
    RAISE EXCEPTION 'invalid inventory reservation transition input' USING ERRCODE = '22023';
  END IF;

  SELECT r.* INTO v_reservation
  FROM public.inventory_reservations AS r
  WHERE r.id = p_reservation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'inventory reservation not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT m.* INTO v_existing
  FROM public.inventory_movements AS m
  WHERE m.idempotency_key = p_idempotency_key;

  IF FOUND THEN
    IF v_existing.reservation_id = p_reservation_id
       AND v_existing.movement_type = 'reservation_' || p_to_status
       AND v_existing.actor_id IS NOT DISTINCT FROM p_actor_id
       AND v_existing.reason IS NOT DISTINCT FROM p_reason
       AND v_reservation.status = p_to_status THEN
      RETURN v_reservation.status;
    END IF;
    RAISE EXCEPTION 'conflicting inventory transition retry' USING ERRCODE = '23505';
  END IF;

  IF v_reservation.status <> 'active' THEN
    RAISE EXCEPTION 'reservation is already terminal in status %', v_reservation.status USING ERRCODE = 'P0001';
  END IF;

  IF p_to_status = 'expired' AND v_reservation.expires_at > pg_catalog.now() THEN
    RAISE EXCEPTION 'reservation has not expired' USING ERRCODE = 'P0001';
  END IF;

  SELECT i.* INTO v_inventory
  FROM public.inventory AS i
  WHERE i.variant_id = v_reservation.variant_id
  FOR UPDATE;

  IF NOT FOUND OR v_inventory.reserved < v_reservation.quantity THEN
    RAISE EXCEPTION 'inventory reservation balance is inconsistent' USING ERRCODE = '23514';
  END IF;

  v_on_hand_delta := CASE WHEN p_to_status = 'consumed' THEN -v_reservation.quantity ELSE 0 END;
  v_movement_type := 'reservation_' || p_to_status;

  UPDATE public.inventory
  SET on_hand = on_hand + v_on_hand_delta,
      reserved = reserved - v_reservation.quantity
  WHERE variant_id = v_reservation.variant_id
  RETURNING * INTO v_inventory;

  UPDATE public.inventory_reservations
  SET status = p_to_status, terminal_at = pg_catalog.now()
  WHERE id = p_reservation_id;

  INSERT INTO public.inventory_movements (
    variant_id, movement_type, on_hand_delta, reserved_delta, on_hand_after,
    reserved_after, reservation_id, actor_id, idempotency_key, reason
  ) VALUES (
    v_reservation.variant_id, v_movement_type, v_on_hand_delta,
    -v_reservation.quantity, v_inventory.on_hand, v_inventory.reserved,
    p_reservation_id, p_actor_id, p_idempotency_key, p_reason
  );

  INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, old_values, new_values)
  VALUES (
    p_actor_id, 'inventory.reservation_' || p_to_status,
    'inventory_reservation', p_reservation_id,
    pg_catalog.jsonb_build_object('status', 'active'),
    pg_catalog.jsonb_build_object('status', p_to_status)
  );

  RETURN p_to_status;
END;
$$;

ALTER FUNCTION private.transition_inventory_reservation(UUID, TEXT, TEXT, UUID, TEXT) OWNER TO postgres;
