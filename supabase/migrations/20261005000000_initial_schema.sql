-- 1968 Clothing / 7Trumpets - Unified Clean Schema
-- Enables UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Categories
CREATE TABLE IF NOT EXISTS public.categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Products
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    category_id TEXT REFERENCES public.categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'published',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Product Variants
CREATE TABLE IF NOT EXISTS public.product_variants (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    price_minor INTEGER NOT NULL CHECK (price_minor >= 0),
    compare_at_price_minor INTEGER CHECK (compare_at_price_minor IS NULL OR compare_at_price_minor >= 0),
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Inventory
CREATE TABLE IF NOT EXISTS public.inventory (
    variant_id TEXT PRIMARY KEY REFERENCES public.product_variants(id) ON DELETE CASCADE,
    on_hand INTEGER NOT NULL DEFAULT 0 CHECK (on_hand >= 0),
    reserved INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0),
    safety_stock INTEGER NOT NULL DEFAULT 0 CHECK (safety_stock >= 0),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Product Images
CREATE TABLE IF NOT EXISTS public.product_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    alt_text TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Orders
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_email TEXT,
    shipping_address JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED', 'PREPARING', 'SHIPPING', 'ARRIVING', 'DELIVERED', 'CANCELLED')),
    payment_method TEXT NOT NULL DEFAULT 'COD' CHECK (payment_method IN ('COD', 'GCASH')),
    payment_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'PAID', 'FAILED', 'CANCELLED')),
    subtotal_minor INTEGER NOT NULL DEFAULT 0 CHECK (subtotal_minor >= 0),
    shipping_minor INTEGER NOT NULL DEFAULT 0 CHECK (shipping_minor >= 0),
    total_minor INTEGER NOT NULL DEFAULT 0 CHECK (total_minor >= 0),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Order Items
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    variant_id TEXT REFERENCES public.product_variants(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    variant_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price_minor INTEGER NOT NULL CHECK (unit_price_minor >= 0),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);
CREATE INDEX IF NOT EXISTS idx_variants_product ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_images_product ON public.product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);

-- Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Catalog Public Read Policies
CREATE POLICY "Public read categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Public read products" ON public.products FOR SELECT USING (status = 'published');
CREATE POLICY "Public read variants" ON public.product_variants FOR SELECT USING (status = 'active');
CREATE POLICY "Public read inventory" ON public.inventory FOR SELECT USING (true);
CREATE POLICY "Public read product images" ON public.product_images FOR SELECT USING (true);

-- Orders Policies
CREATE POLICY "Public create order" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read own order" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Public create order items" ON public.order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read order items" ON public.order_items FOR SELECT USING (true);

-- Permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.categories, public.products, public.product_variants, public.inventory, public.product_images TO anon, authenticated;
GRANT INSERT, SELECT ON public.orders, public.order_items TO anon, authenticated;
