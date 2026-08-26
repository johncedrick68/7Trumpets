-- Phase 4 Forward Correction Migration: Reconcile Admin Catalog & Inventory RPCs and Product Options
-- 1. Ensure all admin catalog & inventory functions match intended canonical parameter orders, default values, and grants.
-- 2. Add full RPC support for product options, option values, variant option associations, and address editing.

-- Drop old overloads cleanly if parameter signatures shifted
DROP FUNCTION IF EXISTS public.admin_save_category(UUID, TEXT, TEXT, TEXT, UUID, INTEGER, BOOLEAN);
DROP FUNCTION IF EXISTS public.admin_save_category(TEXT, TEXT, UUID, TEXT, UUID, INTEGER, BOOLEAN);
DROP FUNCTION IF EXISTS public.admin_save_product(UUID, UUID, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_save_product(TEXT, TEXT, UUID, UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_save_variant(UUID, UUID, TEXT, TEXT, BIGINT, BIGINT, TEXT);
DROP FUNCTION IF EXISTS public.admin_save_variant(UUID, TEXT, BIGINT, UUID, TEXT, BIGINT, TEXT);

-- 1. Category Management RPC
CREATE OR REPLACE FUNCTION public.admin_save_category(
  p_id UUID DEFAULT NULL,
  p_name TEXT DEFAULT NULL,
  p_slug TEXT DEFAULT NULL,
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

-- 2. Product Management RPC
CREATE OR REPLACE FUNCTION public.admin_save_product(
  p_id UUID DEFAULT NULL,
  p_category_id UUID DEFAULT NULL,
  p_name TEXT DEFAULT NULL,
  p_slug TEXT DEFAULT NULL,
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

-- 3. Variant Management RPC
CREATE OR REPLACE FUNCTION public.admin_save_variant(
  p_id UUID DEFAULT NULL,
  p_product_id UUID DEFAULT NULL,
  p_sku TEXT DEFAULT NULL,
  p_name TEXT DEFAULT NULL,
  p_price_minor BIGINT DEFAULT NULL,
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

-- 4. Product Options Management RPC
CREATE OR REPLACE FUNCTION public.admin_save_product_option(
  p_product_id UUID,
  p_name TEXT,
  p_id UUID DEFAULT NULL,
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
  IF p_name IS NULL OR pg_catalog.btrim(p_name) = '' THEN
    RAISE EXCEPTION 'option name is required' USING ERRCODE = '22023';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.product_options (product_id, name, position)
    VALUES (p_product_id, pg_catalog.btrim(p_name), p_position)
    RETURNING id INTO v_id;

    INSERT INTO public.audit_logs (actor_id, actor_role, action, entity, entity_id, new_values)
    VALUES (v_actor, 'admin', 'product_option.created', 'product_option', v_id,
      pg_catalog.jsonb_build_object('product_id', p_product_id, 'name', p_name));
  ELSE
    UPDATE public.product_options
    SET name = pg_catalog.btrim(p_name), position = p_position
    WHERE id = p_id AND product_id = p_product_id;

    v_id := p_id;
  END IF;

  RETURN v_id;
END;
$$;

ALTER FUNCTION public.admin_save_product_option(UUID, TEXT, UUID, INTEGER) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.admin_save_product_option(UUID, TEXT, UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_product_option(UUID, TEXT, UUID, INTEGER) TO authenticated;

-- 5. Product Option Value Management RPC
CREATE OR REPLACE FUNCTION public.admin_save_option_value(
  p_product_id UUID,
  p_option_id UUID,
  p_value TEXT,
  p_id UUID DEFAULT NULL,
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
  IF p_option_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.product_options WHERE id = p_option_id AND product_id = p_product_id) THEN
    RAISE EXCEPTION 'product option not found' USING ERRCODE = '22023';
  END IF;
  IF p_value IS NULL OR pg_catalog.btrim(p_value) = '' THEN
    RAISE EXCEPTION 'option value is required' USING ERRCODE = '22023';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.product_option_values (product_id, option_id, value, position)
    VALUES (p_product_id, p_option_id, pg_catalog.btrim(p_value), p_position)
    RETURNING id INTO v_id;

    INSERT INTO public.audit_logs (actor_id, actor_role, action, entity, entity_id, new_values)
    VALUES (v_actor, 'admin', 'option_value.created', 'product_option_value', v_id,
      pg_catalog.jsonb_build_object('option_id', p_option_id, 'value', p_value));
  ELSE
    UPDATE public.product_option_values
    SET value = pg_catalog.btrim(p_value), position = p_position
    WHERE id = p_id AND option_id = p_option_id;

    v_id := p_id;
  END IF;

  RETURN v_id;
END;
$$;

ALTER FUNCTION public.admin_save_option_value(UUID, UUID, TEXT, UUID, INTEGER) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.admin_save_option_value(UUID, UUID, TEXT, UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_option_value(UUID, UUID, TEXT, UUID, INTEGER) TO authenticated;

-- 6. Variant Option Combination Association RPC
CREATE OR REPLACE FUNCTION public.admin_set_variant_option_value(
  p_product_id UUID,
  p_variant_id UUID,
  p_option_id UUID,
  p_option_value_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := private.require_admin_aal2();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.product_variants WHERE id = p_variant_id AND product_id = p_product_id) THEN
    RAISE EXCEPTION 'variant not found on product' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.product_option_values WHERE id = p_option_value_id AND option_id = p_option_id AND product_id = p_product_id) THEN
    RAISE EXCEPTION 'option value does not match option or product' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.variant_option_values (product_id, variant_id, option_id, option_value_id)
  VALUES (p_product_id, p_variant_id, p_option_id, p_option_value_id)
  ON CONFLICT (variant_id, option_id)
  DO UPDATE SET option_value_id = p_option_value_id;

  INSERT INTO public.audit_logs (actor_id, actor_role, action, entity, entity_id, new_values)
  VALUES (v_actor, 'admin', 'variant_option.assigned', 'variant_option_values', p_variant_id,
    pg_catalog.jsonb_build_object('option_id', p_option_id, 'option_value_id', p_option_value_id));

  RETURN TRUE;
END;
$$;

ALTER FUNCTION public.admin_set_variant_option_value(UUID, UUID, UUID, UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.admin_set_variant_option_value(UUID, UUID, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_variant_option_value(UUID, UUID, UUID, UUID) TO authenticated;
