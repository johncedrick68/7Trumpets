-- Phase 4 Migration: Admin Catalog & Inventory Management RPCs
-- Adds safe, atomic catalog and inventory adjustment procedures.

-- 1. Helper function for admin catalog operations authorization
CREATE OR REPLACE FUNCTION private.require_admin_aal2()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '42501';
  END IF;

  IF coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' THEN
    RAISE EXCEPTION 'AAL2 required for admin mutations' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM private.user_roles
    WHERE user_id = v_actor AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'admin role required' USING ERRCODE = '42501';
  END IF;

  RETURN v_actor;
END;
$$;

ALTER FUNCTION private.require_admin_aal2() OWNER TO postgres;
REVOKE ALL ON FUNCTION private.require_admin_aal2() FROM PUBLIC, anon, authenticated;

-- 2. Category Management RPC
CREATE OR REPLACE FUNCTION public.admin_save_category(
  p_id UUID,
  p_name TEXT,
  p_slug TEXT,
  p_description TEXT DEFAULT NULL,
  p_parent_id UUID DEFAULT NULL,
  p_position INTEGER DEFAULT 0,
  p_archived BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := private.require_admin_aal2();
  v_id UUID;
  v_archived_at TIMESTAMPTZ;
BEGIN
  IF p_name IS NULL OR pg_catalog.btrim(p_name) = '' THEN
    RAISE EXCEPTION 'category name is required' USING ERRCODE = '22023';
  END IF;
  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'invalid category slug' USING ERRCODE = '22023';
  END IF;

  v_archived_at := CASE WHEN p_archived THEN pg_catalog.now() ELSE NULL END;

  IF p_id IS NULL THEN
    INSERT INTO public.categories (name, slug, description, parent_id, position, archived_at)
    VALUES (pg_catalog.btrim(p_name), p_slug, p_description, p_parent_id, p_position, v_archived_at)
    RETURNING id INTO v_id;

    INSERT INTO public.audit_logs (actor_id, actor_role, action, entity, entity_id, new_values)
    VALUES (v_actor, 'admin', 'category.created', 'category', v_id,
      pg_catalog.jsonb_build_object('name', p_name, 'slug', p_slug, 'archived', p_archived));
  ELSE
    UPDATE public.categories
    SET name = pg_catalog.btrim(p_name),
        slug = p_slug,
        description = p_description,
        parent_id = p_parent_id,
        position = p_position,
        archived_at = CASE WHEN p_archived THEN coalesce(archived_at, pg_catalog.now()) ELSE NULL END
    WHERE id = p_id;

    v_id := p_id;

    INSERT INTO public.audit_logs (actor_id, actor_role, action, entity, entity_id, new_values)
    VALUES (v_actor, 'admin', 'category.updated', 'category', v_id,
      pg_catalog.jsonb_build_object('name', p_name, 'slug', p_slug, 'archived', p_archived));
  END IF;

  RETURN v_id;
END;
$$;

ALTER FUNCTION public.admin_save_category(UUID, TEXT, TEXT, TEXT, UUID, INTEGER, BOOLEAN) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.admin_save_category(UUID, TEXT, TEXT, TEXT, UUID, INTEGER, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_category(UUID, TEXT, TEXT, TEXT, UUID, INTEGER, BOOLEAN) TO authenticated;

-- 3. Product Management RPC
CREATE OR REPLACE FUNCTION public.admin_save_product(
  p_id UUID,
  p_category_id UUID,
  p_name TEXT,
  p_slug TEXT,
  p_description TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'draft'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := private.require_admin_aal2();
  v_id UUID;
BEGIN
  IF p_name IS NULL OR pg_catalog.btrim(p_name) = '' THEN
    RAISE EXCEPTION 'product name is required' USING ERRCODE = '22023';
  END IF;
  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'invalid product slug' USING ERRCODE = '22023';
  END IF;
  IF p_status NOT IN ('draft', 'published', 'archived') THEN
    RAISE EXCEPTION 'invalid product status' USING ERRCODE = '22023';
  END IF;
  IF p_category_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.categories WHERE id = p_category_id) THEN
    RAISE EXCEPTION 'category not found' USING ERRCODE = 'P0002';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.products (category_id, name, slug, description, status)
    VALUES (p_category_id, pg_catalog.btrim(p_name), p_slug, p_description, p_status)
    RETURNING id INTO v_id;

    INSERT INTO public.audit_logs (actor_id, actor_role, action, entity, entity_id, new_values)
    VALUES (v_actor, 'admin', 'product.created', 'product', v_id,
      pg_catalog.jsonb_build_object('name', p_name, 'slug', p_slug, 'status', p_status));
  ELSE
    UPDATE public.products
    SET category_id = p_category_id,
        name = pg_catalog.btrim(p_name),
        slug = p_slug,
        description = p_description,
        status = p_status
    WHERE id = p_id;

    v_id := p_id;

    INSERT INTO public.audit_logs (actor_id, actor_role, action, entity, entity_id, new_values)
    VALUES (v_actor, 'admin', 'product.updated', 'product', v_id,
      pg_catalog.jsonb_build_object('name', p_name, 'slug', p_slug, 'status', p_status));
  END IF;

  RETURN v_id;
END;
$$;

ALTER FUNCTION public.admin_save_product(UUID, UUID, TEXT, TEXT, TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.admin_save_product(UUID, UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_product(UUID, UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- 4. Variant Management RPC (with automatic inventory row creation)
CREATE OR REPLACE FUNCTION public.admin_save_variant(
  p_id UUID,
  p_product_id UUID,
  p_sku TEXT,
  p_name TEXT,
  p_price_minor BIGINT,
  p_compare_at_price_minor BIGINT DEFAULT NULL,
  p_status TEXT DEFAULT 'active'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := private.require_admin_aal2();
  v_id UUID;
  v_clean_sku TEXT;
BEGIN
  IF p_product_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.products WHERE id = p_product_id) THEN
    RAISE EXCEPTION 'valid product_id required' USING ERRCODE = '22023';
  END IF;
  IF p_sku IS NULL OR pg_catalog.btrim(p_sku) = '' THEN
    RAISE EXCEPTION 'SKU is required' USING ERRCODE = '22023';
  END IF;
  v_clean_sku := pg_catalog.upper(pg_catalog.btrim(p_sku));

  IF p_price_minor IS NULL OR p_price_minor < 0 THEN
    RAISE EXCEPTION 'price_minor must be non-negative integer' USING ERRCODE = '22023';
  END IF;
  IF p_compare_at_price_minor IS NOT NULL AND p_compare_at_price_minor < p_price_minor THEN
    RAISE EXCEPTION 'compare_at_price_minor must be >= price_minor' USING ERRCODE = '22023';
  END IF;
  IF p_status NOT IN ('active', 'inactive', 'archived') THEN
    RAISE EXCEPTION 'invalid variant status' USING ERRCODE = '22023';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.product_variants (product_id, sku, name, price_minor, compare_at_price_minor, status)
    VALUES (p_product_id, v_clean_sku, p_name, p_price_minor, p_compare_at_price_minor, p_status)
    RETURNING id INTO v_id;

    -- Ensure corresponding inventory entry exists
    INSERT INTO public.inventory (variant_id, on_hand, reserved, safety_stock)
    VALUES (v_id, 0, 0, 0)
    ON CONFLICT (variant_id) DO NOTHING;

    INSERT INTO public.audit_logs (actor_id, actor_role, action, entity, entity_id, new_values)
    VALUES (v_actor, 'admin', 'variant.created', 'product_variant', v_id,
      pg_catalog.jsonb_build_object('sku', v_clean_sku, 'price_minor', p_price_minor, 'status', p_status));
  ELSE
    UPDATE public.product_variants
    SET sku = v_clean_sku,
        name = p_name,
        price_minor = p_price_minor,
        compare_at_price_minor = p_compare_at_price_minor,
        status = p_status
    WHERE id = p_id;

    v_id := p_id;

    INSERT INTO public.audit_logs (actor_id, actor_role, action, entity, entity_id, new_values)
    VALUES (v_actor, 'admin', 'variant.updated', 'product_variant', v_id,
      pg_catalog.jsonb_build_object('sku', v_clean_sku, 'price_minor', p_price_minor, 'status', p_status));
  END IF;

  RETURN v_id;
END;
$$;

ALTER FUNCTION public.admin_save_variant(UUID, UUID, TEXT, TEXT, BIGINT, BIGINT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.admin_save_variant(UUID, UUID, TEXT, TEXT, BIGINT, BIGINT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_variant(UUID, UUID, TEXT, TEXT, BIGINT, BIGINT, TEXT) TO authenticated;


-- 5. Product Image Management RPC
CREATE OR REPLACE FUNCTION public.admin_save_product_image(
  p_product_id UUID,
  p_storage_path TEXT,
  p_alt_text TEXT,
  p_variant_id UUID DEFAULT NULL,
  p_position INTEGER DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := private.require_admin_aal2();
  v_id UUID;
BEGIN
  IF p_product_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.products WHERE id = p_product_id) THEN
    RAISE EXCEPTION 'product not found' USING ERRCODE = '22023';
  END IF;
  IF p_storage_path IS NULL OR pg_catalog.btrim(p_storage_path) = '' THEN
    RAISE EXCEPTION 'storage_path is required' USING ERRCODE = '22023';
  END IF;
  IF p_alt_text IS NULL OR pg_catalog.btrim(p_alt_text) = '' THEN
    RAISE EXCEPTION 'alt_text is required' USING ERRCODE = '22023';
  END IF;
  IF p_variant_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.product_variants WHERE id = p_variant_id AND product_id = p_product_id) THEN
    RAISE EXCEPTION 'variant does not belong to product' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.product_images (product_id, variant_id, storage_path, alt_text, position)
  VALUES (p_product_id, p_variant_id, pg_catalog.btrim(p_storage_path), pg_catalog.btrim(p_alt_text), p_position)
  RETURNING id INTO v_id;

  INSERT INTO public.audit_logs (actor_id, actor_role, action, entity, entity_id, new_values)
  VALUES (v_actor, 'admin', 'product_image.added', 'product_image', v_id,
    pg_catalog.jsonb_build_object('product_id', p_product_id, 'storage_path', p_storage_path));

  RETURN v_id;
END;
$$;

ALTER FUNCTION public.admin_save_product_image(UUID, TEXT, TEXT, UUID, INTEGER) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.admin_save_product_image(UUID, TEXT, TEXT, UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_product_image(UUID, TEXT, TEXT, UUID, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_product_image(
  p_image_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := private.require_admin_aal2();
BEGIN
  DELETE FROM public.product_images WHERE id = p_image_id;

  INSERT INTO public.audit_logs (actor_id, actor_role, action, entity, entity_id, old_values)
  VALUES (v_actor, 'admin', 'product_image.deleted', 'product_image', p_image_id,
    pg_catalog.jsonb_build_object('id', p_image_id));

  RETURN TRUE;
END;
$$;

ALTER FUNCTION public.admin_delete_product_image(UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.admin_delete_product_image(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_product_image(UUID) TO authenticated;

-- 6. Trusted Inventory Adjustment RPC
CREATE OR REPLACE FUNCTION public.admin_adjust_inventory(
  p_variant_id UUID,
  p_delta INTEGER,
  p_type TEXT,
  p_reason TEXT,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := private.require_admin_aal2();
  v_inv public.inventory%ROWTYPE;
  v_new_on_hand INTEGER;
  v_movement_id UUID;
BEGIN
  IF p_variant_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.product_variants WHERE id = p_variant_id) THEN
    RAISE EXCEPTION 'variant not found' USING ERRCODE = 'P0002';
  END IF;
  IF p_delta IS NULL OR p_delta = 0 THEN
    RAISE EXCEPTION 'delta must be non-zero' USING ERRCODE = '22023';
  END IF;
  IF p_type NOT IN ('adjustment', 'restock') THEN
    RAISE EXCEPTION 'type must be adjustment or restock' USING ERRCODE = '22023';
  END IF;
  IF p_reason IS NULL OR pg_catalog.btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'reason is required' USING ERRCODE = '22023';
  END IF;
  IF p_idempotency_key IS NULL OR pg_catalog.btrim(p_idempotency_key) = '' OR pg_catalog.length(p_idempotency_key) > 128 THEN
    RAISE EXCEPTION 'valid idempotency_key is required' USING ERRCODE = '22023';
  END IF;

  -- Lock inventory row for update
  SELECT * INTO v_inv
  FROM public.inventory
  WHERE variant_id = p_variant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.inventory (variant_id, on_hand, reserved, safety_stock)
    VALUES (p_variant_id, 0, 0, 0)
    RETURNING * INTO v_inv;
  END IF;

  -- Check existing idempotency key in inventory_movements
  IF EXISTS (SELECT 1 FROM public.inventory_movements WHERE idempotency_key = p_idempotency_key) THEN
    RETURN pg_catalog.jsonb_build_object(
      'variant_id', v_inv.variant_id,
      'on_hand', v_inv.on_hand,
      'reserved', v_inv.reserved,
      'idempotent_replay', true
    );
  END IF;

  v_new_on_hand := v_inv.on_hand + p_delta;
  IF v_new_on_hand < 0 THEN
    RAISE EXCEPTION 'adjustment would cause negative on_hand inventory' USING ERRCODE = '23514';
  END IF;
  IF v_new_on_hand < (v_inv.reserved + v_inv.safety_stock) THEN
    RAISE EXCEPTION 'adjustment would violate reserved inventory constraints' USING ERRCODE = '23514';
  END IF;

  UPDATE public.inventory
  SET on_hand = v_new_on_hand
  WHERE variant_id = p_variant_id
  RETURNING * INTO v_inv;

  INSERT INTO public.inventory_movements (
    variant_id, movement_type, on_hand_delta, reserved_delta,
    on_hand_after, reserved_after, actor_id, idempotency_key, reason
  ) VALUES (
    p_variant_id, p_type, p_delta, 0,
    v_inv.on_hand, v_inv.reserved, v_actor, p_idempotency_key, pg_catalog.btrim(p_reason)
  ) RETURNING id INTO v_movement_id;

  INSERT INTO public.audit_logs (actor_id, actor_role, action, entity, entity_id, new_values)
  VALUES (v_actor, 'admin', 'inventory.' || p_type, 'inventory_movement', v_movement_id,
    pg_catalog.jsonb_build_object(
      'variant_id', p_variant_id,
      'delta', p_delta,
      'on_hand_after', v_inv.on_hand,
      'reason', p_reason
    ));

  RETURN pg_catalog.jsonb_build_object(
    'variant_id', v_inv.variant_id,
    'on_hand', v_inv.on_hand,
    'reserved', v_inv.reserved,
    'movement_id', v_movement_id
  );
END;
$$;

ALTER FUNCTION public.admin_adjust_inventory(UUID, INTEGER, TEXT, TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.admin_adjust_inventory(UUID, INTEGER, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_adjust_inventory(UUID, INTEGER, TEXT, TEXT, TEXT) TO authenticated;
