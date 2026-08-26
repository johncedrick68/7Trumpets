BEGIN;

-- 1. Categories
INSERT INTO public.categories (id, name, slug, description, position)
VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Current Drops', 'drops', 'Fresh limited-run streetwear releases.', 1),
  ('c1000000-0000-0000-0000-000000000002', 'San Roque Collection', 'san-roque', 'Exclusive fiesta and community heritage editions.', 2),
  ('c1000000-0000-0000-0000-000000000003', '1968 Classics', 'classics', 'Core brand staples and everyday essentials.', 3)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- 2. Products
INSERT INTO public.products (id, category_id, name, slug, description, status)
VALUES
  ('b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Rise to Defend', 'rise-to-defend', 'Premium heavyweight cotton streetwear tee featuring the iconic Rise to Defend backprint artwork.', 'published'),
  ('b1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', 'TGP — Triskelion', 'tgp-triskelion', 'Signature Tau Gamma Phi fraternity tribute streetwear tee crafted with high-density screenprint detailing.', 'published'),
  ('b1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 'Triskelion Supreme', 'triskelion-supreme', 'Refined heritage edition streetwear shirt featuring the Triskelion Supreme emblem.', 'published'),
  ('b1000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000003', '1968 Classic', '1968-classic', 'The founding emblem tee. Clean typography and enduring heavyweight finish.', 'published'),
  ('b1000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000001', 'Street Edition', 'street-edition', 'Urban streetwear silhouette built for comfort, movement, and daily expression.', 'published'),
  ('b1000000-0000-0000-0000-000000000006', 'c1000000-0000-0000-0000-000000000003', 'Urban Classic', 'urban-classic', 'Subtle chest embroidery and relaxed boxy cut for a clean everyday street look.', 'published'),
  ('b1000000-0000-0000-0000-000000000007', 'c1000000-0000-0000-0000-000000000002', 'San Roque Black', 'san-roque-black', 'San Roque Fiesta 2026 commemorative release in deep black with metallic screenprint.', 'published'),
  ('b1000000-0000-0000-0000-000000000008', 'c1000000-0000-0000-0000-000000000002', 'San Roque Dark Gray', 'san-roque-dark-gray', 'San Roque Fiesta 2026 edition in charcoal dark gray with tonal contrast detailing.', 'published'),
  ('b1000000-0000-0000-0000-000000000009', 'c1000000-0000-0000-0000-000000000002', 'San Roque White', 'san-roque-white', 'Crisp white commemorative streetwear piece honoring the San Roque community heritage.', 'published'),
  ('b1000000-0000-0000-0000-000000000010', 'c1000000-0000-0000-0000-000000000002', 'San Roque Orange', 'san-roque-orange', 'Vibrant festive orange limited release engineered with fade-resistant pigments.', 'published'),
  ('b1000000-0000-0000-0000-000000000011', 'c1000000-0000-0000-0000-000000000001', 'Tenets #2', 'tenets-2', 'Essential tenets and principles rendered across an oversized streetwear drop.', 'published')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, status = EXCLUDED.status;

-- 3. Product Variants (Sizes S, M, L, XL, 2XL)
INSERT INTO public.product_variants (id, product_id, sku, name, price_minor, compare_at_price_minor, status)
VALUES
  -- Rise to Defend (₱499, old ₱599)
  ('a1000000-0001-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'PROD-001-S', 'Size S', 49900, 59900, 'active'),
  ('a1000000-0001-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001', 'PROD-001-M', 'Size M', 49900, 59900, 'active'),
  ('a1000000-0001-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000001', 'PROD-001-L', 'Size L', 49900, 59900, 'active'),
  ('a1000000-0001-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000001', 'PROD-001-XL', 'Size XL', 49900, 59900, 'active'),
  ('a1000000-0001-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000001', 'PROD-001-2XL', 'Size 2XL', 49900, 59900, 'active'),

  -- TGP — Triskelion (₱499, old ₱599)
  ('a1000000-0002-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002', 'PROD-002-S', 'Size S', 49900, 59900, 'active'),
  ('a1000000-0002-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', 'PROD-002-M', 'Size M', 49900, 59900, 'active'),
  ('a1000000-0002-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000002', 'PROD-002-L', 'Size L', 49900, 59900, 'active'),
  ('a1000000-0002-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000002', 'PROD-002-XL', 'Size XL', 49900, 59900, 'active'),
  ('a1000000-0002-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000002', 'PROD-002-2XL', 'Size 2XL', 49900, 59900, 'active'),

  -- Triskelion Supreme (₱499)
  ('a1000000-0003-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000003', 'PROD-003-M', 'Size M', 49900, null, 'active'),
  ('a1000000-0003-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000003', 'PROD-003-L', 'Size L', 49900, null, 'active'),
  ('a1000000-0003-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000003', 'PROD-003-XL', 'Size XL', 49900, null, 'active'),

  -- 1968 Classic (₱499)
  ('a1000000-0004-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000004', 'PROD-004-M', 'Size M', 49900, null, 'active'),
  ('a1000000-0004-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000004', 'PROD-004-L', 'Size L', 49900, null, 'active'),
  ('a1000000-0004-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000004', 'PROD-004-XL', 'Size XL', 49900, null, 'active'),

  -- Street Edition (₱499)
  ('a1000000-0005-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000005', 'PROD-005-M', 'Size M', 49900, null, 'active'),
  ('a1000000-0005-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000005', 'PROD-005-L', 'Size L', 49900, null, 'active'),

  -- Urban Classic (₱499)
  ('a1000000-0006-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000006', 'PROD-006-M', 'Size M', 49900, null, 'active'),
  ('a1000000-0006-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000006', 'PROD-006-L', 'Size L', 49900, null, 'active'),

  -- San Roque Black (₱550)
  ('a1000000-0007-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000007', 'PROD-008-M', 'Size M', 55000, null, 'active'),
  ('a1000000-0007-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000007', 'PROD-008-L', 'Size L', 55000, null, 'active'),
  ('a1000000-0007-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000007', 'PROD-008-XL', 'Size XL', 55000, null, 'active'),

  -- San Roque Dark Gray (₱550)
  ('a1000000-0008-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000008', 'PROD-009-M', 'Size M', 55000, null, 'active'),
  ('a1000000-0008-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000008', 'PROD-009-L', 'Size L', 55000, null, 'active'),

  -- San Roque White (₱550)
  ('a1000000-0009-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000009', 'PROD-010-M', 'Size M', 55000, null, 'active'),
  ('a1000000-0009-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000009', 'PROD-010-L', 'Size L', 55000, null, 'active'),

  -- San Roque Orange (₱550, old ₱650)
  ('a1000000-0010-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000010', 'PROD-011-M', 'Size M', 55000, 65000, 'active'),
  ('a1000000-0010-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000010', 'PROD-011-L', 'Size L', 55000, 65000, 'active'),

  -- Tenets #2 (₱550, old ₱650)
  ('a1000000-0011-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000011', 'PROD-068-M', 'Size M', 55000, 65000, 'active'),
  ('a1000000-0011-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000011', 'PROD-068-L', 'Size L', 55000, 65000, 'active')
ON CONFLICT (id) DO UPDATE SET price_minor = EXCLUDED.price_minor, compare_at_price_minor = EXCLUDED.compare_at_price_minor, status = EXCLUDED.status;

-- 4. Inventory
INSERT INTO public.inventory (variant_id, on_hand, reserved, safety_stock)
SELECT id, 30, 0, 3 FROM public.product_variants
ON CONFLICT (variant_id) DO UPDATE SET on_hand = 30, reserved = 0, safety_stock = 3;

-- 5. Product Images
INSERT INTO public.product_images (product_id, storage_path, alt_text, position)
VALUES
  ('b1000000-0000-0000-0000-000000000001', '/images/1968%20CLOTHING%20V1.webp', 'Rise to Defend Main', 1),
  ('b1000000-0000-0000-0000-000000000001', '/images/1968%20CLOTHING%20V1.0.webp', 'Rise to Defend Detail', 2),
  ('b1000000-0000-0000-0000-000000000001', '/images/1968%20CLOTHING%20V1.1.webp', 'Rise to Defend Angle', 3),

  ('b1000000-0000-0000-0000-000000000002', '/images/1968%20CLOTHING%20V2.webp', 'TGP Triskelion Main', 1),
  ('b1000000-0000-0000-0000-000000000002', '/images/1968%20CLOTHING%20V2.0.webp', 'TGP Triskelion Detail', 2),

  ('b1000000-0000-0000-0000-000000000003', '/images/1968%20CLOTHING%20V3%20-%20SAN%20ROQUE.webp', 'Triskelion Supreme Main', 1),
  ('b1000000-0000-0000-0000-000000000003', '/images/1968%20CLOTHING%20V3.1%20-%20SAN%20ROQUE.webp', 'Triskelion Supreme Detail', 2),

  ('b1000000-0000-0000-0000-000000000004', '/images/1968%20CLOTHING%20V4.webp', '1968 Classic Main', 1),
  ('b1000000-0000-0000-0000-000000000004', '/images/1968%20CLOTHING%20V4.1.webp', '1968 Classic Detail', 2),

  ('b1000000-0000-0000-0000-000000000005', '/images/1968%20CLOTHING%20V5.webp', 'Street Edition Main', 1),

  ('b1000000-0000-0000-0000-000000000006', '/images/1968%20CLOTHING%20V5.1.webp', 'Urban Classic Main', 1),

  ('b1000000-0000-0000-0000-000000000007', '/images/SAN%20ROQUE%20FS%202026%20V1.2.webp', 'San Roque Black Main', 1),

  ('b1000000-0000-0000-0000-000000000008', '/images/SAN%20ROQUE%20FS%202026%20V1.3.webp', 'San Roque Dark Gray Main', 1),

  ('b1000000-0000-0000-0000-000000000009', '/images/SAN%20ROQUE%20FS%202026%20V1.4.webp', 'San Roque White Main', 1),

  ('b1000000-0000-0000-0000-000000000010', '/images/SAN%20ROQUE%20FS%202026%20V1.5.webp', 'San Roque Orange Main', 1),

  ('b1000000-0000-0000-0000-000000000011', '/images/1968%20CLOTHING%20V8.1.webp', 'Tenets #2 Main', 1)
ON CONFLICT (id) DO NOTHING;

COMMIT;
