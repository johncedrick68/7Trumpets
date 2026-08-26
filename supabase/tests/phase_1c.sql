begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(175);

-- Schema contract
select extensions.set_eq(
  $$
    select schemaname || '.' || tablename
    from pg_catalog.pg_tables
    where schemaname in ('public', 'private')
  $$,
  $$ values
    ('public.profiles'), ('private.user_roles'), ('private.commerce_throttles'),
    ('public.categories'), ('public.products'), ('public.product_variants'),
    ('public.product_options'), ('public.product_option_values'),
    ('public.variant_option_values'), ('public.product_images'),
    ('public.inventory'), ('public.inventory_movements'),
    ('public.inventory_reservations'), ('public.carts'), ('public.cart_items'),
    ('public.addresses'), ('public.orders'), ('public.order_items'),
    ('public.order_status_history'), ('public.payments'),
    ('public.payment_submissions'), ('public.payment_events'),
    ('public.audit_logs')
  $$,
  'the 22 Phase 1 tables plus the Phase 3B throttle table exist'
);

select extensions.is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and data_type = 'bigint'
      and (table_name, column_name) in (
        ('product_variants', 'price_minor'),
        ('product_variants', 'compare_at_price_minor'),
        ('orders', 'subtotal_minor'), ('orders', 'discount_minor'),
        ('orders', 'shipping_minor'), ('orders', 'total_minor'),
        ('order_items', 'unit_price_minor'),
        ('order_items', 'unit_discount_minor'),
        ('order_items', 'line_subtotal_minor'),
        ('order_items', 'line_discount_minor'),
        ('order_items', 'line_total_minor'), ('payments', 'amount_minor'),
        ('payment_submissions', 'claimed_amount_minor')
      )
  ),
  13::bigint,
  'all authoritative money columns are bigint'
);

select extensions.col_type_is('public', 'order_items', 'selected_options', 'jsonb', 'selected options are an object-capable type');
select extensions.col_type_is('public', 'audit_logs', 'ip_address', 'inet', 'audit IP addresses use inet');

select extensions.set_eq(
  $$
    select indexname
    from pg_catalog.pg_indexes
    where schemaname = 'public' and indexname in (
      'categories_parent_id_idx', 'products_category_status_idx',
      'product_variants_product_status_idx',
      'product_images_product_position_idx',
      'product_options_product_position_idx',
      'product_option_values_option_position_idx',
      'inventory_movements_variant_created_idx',
      'inventory_reservations_variant_status_idx',
      'inventory_reservations_active_expires_idx',
      'orders_user_created_idx', 'orders_status_created_idx',
      'order_items_order_id_idx', 'order_status_history_order_created_idx',
      'payment_submissions_payment_created_idx',
      'payment_events_payment_created_idx', 'audit_logs_entity_created_idx',
      'addresses_one_default_per_user_uidx'
    )
  $$,
  $$ values
    ('categories_parent_id_idx'), ('products_category_status_idx'),
    ('product_variants_product_status_idx'),
    ('product_images_product_position_idx'),
    ('product_options_product_position_idx'),
    ('product_option_values_option_position_idx'),
    ('inventory_movements_variant_created_idx'),
    ('inventory_reservations_variant_status_idx'),
    ('inventory_reservations_active_expires_idx'),
    ('orders_user_created_idx'), ('orders_status_created_idx'),
    ('order_items_order_id_idx'), ('order_status_history_order_created_idx'),
    ('payment_submissions_payment_created_idx'),
    ('payment_events_payment_created_idx'), ('audit_logs_entity_created_idx'),
    ('addresses_one_default_per_user_uidx')
  $$,
  'query-driven and one-default-address indexes exist'
);

select extensions.throws_ok(
  $$
    insert into public.orders (
      idempotency_key, subtotal_minor, discount_minor, shipping_minor,
      total_minor, customer_email, recipient_name, recipient_phone,
      address_line1, city_municipality, province, postal_code
    ) values (
      'bad-total', 1000, 100, 50, 1000, 'bad@example.test', 'Bad Total',
      '1', 'Street', 'City', 'Province', '1000'
    )
  $$,
  '23514', null, 'order total equation is enforced'
);

select extensions.throws_ok(
  $$
    insert into public.orders (
      idempotency_key, status, subtotal_minor, total_minor, customer_email,
      recipient_name, recipient_phone, address_line1, city_municipality,
      province, postal_code
    ) values (
      'bad-initial-status', 'PROCESSING', 1000, 1000, 'bad@example.test',
      'Bad Status', '1', 'Street', 'City', 'Province', '1000'
    )
  $$,
  '23514', 'initial order status must be CONFIRMED',
  'orders can only be inserted initially as CONFIRMED'
);

-- Storage contract, without depending on storage implementation details.
select extensions.set_eq(
  $$ select id from storage.buckets $$,
  $$ values ('product-images'), ('payment-receipts') $$,
  'exactly two buckets exist and return-proofs is absent'
);

select extensions.ok(
  (select public and file_size_limit = 5242880 and allowed_mime_types = array['image/webp']::text[]
   from storage.buckets where id = 'product-images'),
  'product images bucket is public WebP with a 5 MB limit'
);

select extensions.ok(
  (select not public and file_size_limit = 2097152
          and allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[]
   from storage.buckets where id = 'payment-receipts'),
  'payment receipts bucket is private with approved MIME types and a 2 MB limit'
);

-- Auth fixtures exercise the real auth.users trigger. Privilege-shaped metadata is ignored.
insert into auth.users (
  id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  (
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'customer1@example.test', '{}'::jsonb,
    '{"display_name":" Customer One ","phone":" 0917 ","role":"admin","is_admin":true}'::jsonb,
    now(), now()
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'customer2@example.test', '{}'::jsonb, '{"role":"super_admin"}'::jsonb, now(), now()
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'super@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'target@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
  );

select extensions.results_eq(
  $$ select display_name, phone from public.profiles where id = '11111111-1111-1111-1111-111111111111' $$,
  $$ values ('Customer One'::text, '0917'::text) $$,
  'auth trigger creates a profile from allowlisted trimmed metadata'
);

select extensions.set_eq(
  $$ select role from private.user_roles where user_id = '11111111-1111-1111-1111-111111111111' $$,
  $$ values ('customer') $$,
  'auth trigger creates only the customer role despite admin metadata'
);

select extensions.set_eq(
  $$ select role from private.user_roles where user_id = '22222222-2222-2222-2222-222222222222' $$,
  $$ values ('customer') $$,
  'auth trigger creates only the customer role despite super_admin metadata'
);

select pg_catalog.set_config('request.jwt.claim.sub', '', true);
select pg_catalog.set_config('request.jwt.claims', '{}'::text, true);
select extensions.is(private.has_role('customer'), false, 'has_role returns false without authentication');

select extensions.throws_ok(
  $$ select private.has_role('owner') $$,
  '22023', 'unsupported role: owner', 'has_role rejects unsupported roles'
);

insert into private.user_roles (user_id, role, assigned_by)
values ('33333333-3333-3333-3333-333333333333', 'super_admin', null);

select extensions.throws_ok(
  $$ select public.manage_user_role('44444444-4444-4444-4444-444444444444', 'admin', true) $$,
  '42501', 'authentication required', 'role management rejects unauthenticated calls'
);

select pg_catalog.set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select pg_catalog.set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select extensions.throws_ok(
  $$ select public.manage_user_role('11111111-1111-1111-1111-111111111111', 'admin', true) $$,
  '42501', 'super_admin required', 'an AAL2 customer cannot self-promote'
);
reset role;

select pg_catalog.set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
select pg_catalog.set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select extensions.throws_ok(
  $$ select public.manage_user_role('44444444-4444-4444-4444-444444444444', 'admin', true) $$,
  '42501', 'AAL2 required', 'a super_admin at AAL1 cannot manage roles'
);
reset role;

select pg_catalog.set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select extensions.ok(
  public.manage_user_role('44444444-4444-4444-4444-444444444444', 'admin', true),
  'an AAL2 super_admin can assign an admin role'
);
select extensions.throws_ok(
  $$ select public.manage_user_role('33333333-3333-3333-3333-333333333333', 'super_admin', false) $$,
  '23514', 'cannot remove the last super_admin', 'the last super_admin cannot be removed'
);
select extensions.ok(
  public.manage_user_role('44444444-4444-4444-4444-444444444444', 'admin', false),
  'an AAL2 super_admin can remove an admin role'
);
reset role;

select extensions.ok(
  not exists (select 1 from private.user_roles where user_id = '44444444-4444-4444-4444-444444444444' and role = 'admin'),
  'role removal is persisted'
);
select extensions.ok(
  (select count(*)
   from public.audit_logs
   where actor_id = '33333333-3333-3333-3333-333333333333'
     and entity_id = '44444444-4444-4444-4444-444444444444'
     and action in ('role.assigned', 'role.removed')) = 2,
  'role assignment and removal record their auth-derived actor in audit'
);

insert into private.user_roles (user_id, role, assigned_by)
values (
  '22222222-2222-2222-2222-222222222222', 'admin',
  '33333333-3333-3333-3333-333333333333'
);

select pg_catalog.set_config('request.jwt.claim.sub', '', true);
select pg_catalog.set_config('request.jwt.claims', '{}'::text, true);

-- Shared commerce fixtures.
insert into public.products (id, slug, name, status)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'phase-one-product', 'Phase One Product', 'published');

insert into public.product_variants (id, product_id, sku, price_minor)
values (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'PHASE-ONE-SKU', 10000
);

insert into public.inventory (variant_id, on_hand)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 20);

select extensions.throws_ok(
  $$
    update public.inventory
    set reserved = 21
    where variant_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  $$,
  '23514', null, 'inventory cannot reserve more than on-hand stock'
);

select extensions.ok(
  (public.checkout_order(
    '33333333-3333-3333-3333-333333333333', 'checkout-cod',
    '[{"variant_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","quantity":2}]'::jsonb,
    500, 'COD', null,
    '{"customer_email":"super@example.test","recipient_name":"Checkout COD","recipient_phone":"0917","address_line1":"One Street","city_municipality":"City","province":"Province","postal_code":"1000","country_code":"PH"}'::jsonb,
    null
  )).id is not null,
  'authoritative COD checkout creates an order'
);

select extensions.results_eq(
  $$
    select o.status, o.subtotal_minor, o.shipping_minor, o.total_minor,
           p.method, p.status, p.amount_minor, oi.quantity, oi.unit_price_minor,
           oi.line_total_minor, r.status
    from public.orders o
    join public.payments p on p.order_id = o.id
    join public.order_items oi on oi.order_id = o.id
    join public.inventory_reservations r on r.order_id = o.id and r.variant_id = oi.variant_id
    where o.idempotency_key = 'checkout-cod'
  $$,
  $$ values ('CONFIRMED'::text, 20000::bigint, 500::bigint, 20500::bigint,
             'COD'::text, 'UNPAID'::text, 20500::bigint, 2, 10000::bigint,
             20000::bigint, 'consumed'::text) $$,
  'checkout computes totals, creates one matching PHP payment and consumes COD stock'
);

select extensions.is(
  (public.checkout_order(
    '33333333-3333-3333-3333-333333333333', 'checkout-cod',
    '[{"variant_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","quantity":2}]'::jsonb,
    500, 'COD', null,
    '{"customer_email":"super@example.test","recipient_name":"Checkout COD","recipient_phone":"0917","address_line1":"One Street","city_municipality":"City","province":"Province","postal_code":"1000","country_code":"PH"}'::jsonb,
    null
  )).id,
  (select id from public.orders where idempotency_key = 'checkout-cod'),
  'exact checkout retry returns the original order'
);

select extensions.throws_ok(
  $$
    select public.checkout_order(
      '33333333-3333-3333-3333-333333333333', 'checkout-cod',
      '[{"variant_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","quantity":2}]'::jsonb,
      501, 'COD', null,
      '{"customer_email":"super@example.test","recipient_name":"Checkout COD","recipient_phone":"0917","address_line1":"One Street","city_municipality":"City","province":"Province","postal_code":"1000","country_code":"PH"}'::jsonb,
      null
    )
  $$,
  '23505', 'conflicting checkout retry', 'changed checkout retry input is rejected'
);

select extensions.ok(
  (public.checkout_order(
    '33333333-3333-3333-3333-333333333333', 'checkout-gcash',
    '[{"variant_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","quantity":3}]'::jsonb,
    0, 'MANUAL_GCASH', '2100-01-01 00:00:00+00'::timestamptz,
    '{"customer_email":"super@example.test","recipient_name":"Checkout GCash","recipient_phone":"0917","address_line1":"One Street","city_municipality":"City","province":"Province","postal_code":"1000"}'::jsonb,
    null
  )).id is not null,
  'manual GCash checkout retains an active reservation at the supplied deadline'
);

select extensions.results_eq(
  $$
    select p.amount_minor, p.currency_code, r.quantity, r.status, r.expires_at
    from public.orders o
    join public.payments p on p.order_id = o.id
    join public.inventory_reservations r on r.order_id = o.id
    where o.idempotency_key = 'checkout-gcash'
  $$,
  $$ values (30000::bigint, 'PHP'::text, 3, 'active'::text, '2100-01-01 00:00:00+00'::timestamptz) $$,
  'GCash payment and reservation match authoritative checkout totals and quantity'
);

insert into storage.objects (bucket_id, name, owner_id, metadata)
select
  'payment-receipts',
  '33333333-3333-3333-3333-333333333333/' || o.id::text || '/77777777-aaaa-aaaa-aaaa-777777777777.webp',
  '33333333-3333-3333-3333-333333333333',
  '{"size":100,"mimetype":"image/webp"}'::jsonb
from public.orders o where o.idempotency_key = 'checkout-gcash';

select extensions.ok(
  private.submit_gcash_proof(
    (select p.id from public.payments p join public.orders o on o.id = p.order_id where o.idempotency_key = 'checkout-gcash'),
    '33333333-3333-3333-3333-333333333333', 30000, 'CHECKOUT-REF',
    (select '33333333-3333-3333-3333-333333333333/' || o.id::text || '/77777777-aaaa-aaaa-aaaa-777777777777.webp' from public.orders o where o.idempotency_key = 'checkout-gcash'),
    '2100-01-02 00:00:00+00'::timestamptz, 'checkout-submission', 'checkout-proof-event'
  ) is not null,
  'GCash proof extends the checkout reservation'
);

select extensions.is(
  (public.checkout_order(
    '33333333-3333-3333-3333-333333333333', 'checkout-gcash',
    '[{"variant_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","quantity":3}]'::jsonb,
    0, 'MANUAL_GCASH', '2100-01-01 00:00:00+00'::timestamptz,
    '{"customer_email":"super@example.test","recipient_name":"Checkout GCash","recipient_phone":"0917","address_line1":"One Street","city_municipality":"City","province":"Province","postal_code":"1000"}'::jsonb,
    null
  )).id,
  (select id from public.orders where idempotency_key = 'checkout-gcash'),
  'exact checkout retry uses the original audited expiry after proof extends the reservation'
);

select extensions.throws_ok(
  $$
    select public.checkout_order(
      '33333333-3333-3333-3333-333333333333', 'checkout-duplicate',
      '[{"variant_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","quantity":1},{"variant_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","quantity":1}]'::jsonb,
      0, 'COD', null,
      '{"customer_email":"super@example.test","recipient_name":"Duplicate","recipient_phone":"1","address_line1":"Street","city_municipality":"City","province":"Province","postal_code":"1000"}'::jsonb,
      null
    )
  $$,
  '22023', 'duplicate checkout variant', 'checkout rejects duplicate variant lines'
);

select extensions.throws_ok(
  $$
    select public.checkout_order(
      '33333333-3333-3333-3333-333333333333', 'checkout-no-stock',
      '[{"variant_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","quantity":99}]'::jsonb,
      0, 'COD', null,
      '{"customer_email":"super@example.test","recipient_name":"No Stock","recipient_phone":"1","address_line1":"Street","city_municipality":"City","province":"Province","postal_code":"1000"}'::jsonb,
      null
    )
  $$,
  'P0001', null, 'checkout rejects insufficient stock without creating an order'
);

select extensions.is(
  (select count(*) from public.orders where idempotency_key = 'checkout-no-stock'),
  0::bigint, 'failed checkout leaves no partial order'
);

insert into public.orders (
  id, user_id, idempotency_key, subtotal_minor, total_minor, customer_email,
  recipient_name, recipient_phone, address_line1, city_municipality, province,
  postal_code
) values
  (
    'c1111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111', 'order-cod', 20000, 20000,
    'customer1@example.test', 'Customer One', '0917', 'One Street', 'City',
    'Province', '1000'
  ),
  (
    'c2222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111', 'order-gcash', 10000, 10000,
    'customer1@example.test', 'Customer One', '0917', 'One Street', 'City',
    'Province', '1000'
  ),
  (
    'c3333333-3333-3333-3333-333333333333',
    '22222222-2222-2222-2222-222222222222', 'order-other', 10000, 10000,
    'customer2@example.test', 'Customer Two', '0918', 'Two Street', 'City',
    'Province', '1000'
  );

-- Isolated fixtures for exact forbidden transition pairs.
insert into public.orders (
  id, idempotency_key, subtotal_minor, total_minor, customer_email,
  recipient_name, recipient_phone, address_line1, city_municipality, province,
  postal_code, cancellation_reason
) values
  ('c4444444-4444-4444-4444-444444444444', 'transition-delivered', 0, 0, 'transition@example.test', 'Transition', '1', 'Street', 'City', 'Province', '1000', 'fixture'),
  ('c5555555-5555-5555-5555-555555555555', 'transition-completed', 0, 0, 'transition@example.test', 'Transition', '1', 'Street', 'City', 'Province', '1000', 'fixture'),
  ('c6666666-6666-6666-6666-666666666666', 'transition-cancelled', 0, 0, 'transition@example.test', 'Transition', '1', 'Street', 'City', 'Province', '1000', 'fixture'),
  ('c7777777-7777-7777-7777-777777777777', 'transition-out-for-delivery', 0, 0, 'transition@example.test', 'Transition', '1', 'Street', 'City', 'Province', '1000', 'fixture');

set local session_replication_role = replica;
update public.orders set status = 'DELIVERED' where id = 'c4444444-4444-4444-4444-444444444444';
update public.orders set status = 'COMPLETED' where id = 'c5555555-5555-5555-5555-555555555555';
update public.orders set status = 'CANCELLED' where id = 'c6666666-6666-6666-6666-666666666666';
update public.orders set status = 'OUT_FOR_DELIVERY' where id = 'c7777777-7777-7777-7777-777777777777';
set local session_replication_role = origin;

select extensions.throws_ok(
  $$ select public.transition_order('c4444444-4444-4444-4444-444444444444', 'PACKING', null, 'test', null, 'forbidden-delivered-packing', '{}'::jsonb) $$,
  '23514', 'invalid order transition: DELIVERED -> PACKING',
  'DELIVERED cannot transition to PACKING'
);
select extensions.throws_ok(
  $$ select public.transition_order('c5555555-5555-5555-5555-555555555555', 'PROCESSING', null, 'test', null, 'forbidden-completed-processing', '{}'::jsonb) $$,
  '23514', 'invalid order transition: COMPLETED -> PROCESSING',
  'COMPLETED cannot transition to PROCESSING'
);
select extensions.throws_ok(
  $$ select public.transition_order('c6666666-6666-6666-6666-666666666666', 'CONFIRMED', null, 'test', null, 'forbidden-cancelled-confirmed', '{}'::jsonb) $$,
  '23514', 'invalid order transition: CANCELLED -> CONFIRMED',
  'CANCELLED cannot transition to CONFIRMED'
);
select extensions.throws_ok(
  $$ select public.transition_order('c7777777-7777-7777-7777-777777777777', 'PACKING', null, 'test', null, 'forbidden-out-for-delivery-packing', '{}'::jsonb) $$,
  '23514', 'invalid order transition: OUT_FOR_DELIVERY -> PACKING',
  'OUT_FOR_DELIVERY cannot transition to PACKING'
);
select extensions.is(
  (select count(*) from public.order_status_history
   where idempotency_key in (
     'forbidden-delivered-packing', 'forbidden-completed-processing',
     'forbidden-cancelled-confirmed', 'forbidden-out-for-delivery-packing'
   )),
  0::bigint, 'failed forbidden transitions create no history rows'
);

insert into public.order_items (
  order_id, product_id, variant_id, product_name, variant_name, sku, quantity,
  unit_price_minor, unit_discount_minor, line_subtotal_minor,
  line_discount_minor, line_total_minor
) values (
  'c1111111-1111-1111-1111-111111111111',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Phase One Product', 'Default',
  'PHASE-ONE-SKU', 2, 10000, 0, 20000, 0, 20000
);

select extensions.throws_ok(
  $$
    insert into public.order_items (
      order_id, product_name, sku, quantity, unit_price_minor,
      unit_discount_minor, line_subtotal_minor, line_discount_minor,
      line_total_minor
    ) values (
      'c1111111-1111-1111-1111-111111111111', 'Bad Line', 'BAD-LINE', 2,
      100, 0, 100, 0, 100
    )
  $$,
  '23514', null, 'order item money equations are enforced'
);

insert into public.payments (id, order_id, method, amount_minor, idempotency_key)
values
  ('d1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'COD', 20000, 'payment-cod'),
  ('d2222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222222', 'MANUAL_GCASH', 10000, 'payment-gcash'),
  ('d3333333-3333-3333-3333-333333333333', 'c3333333-3333-3333-3333-333333333333', 'COD', 10000, 'payment-other');

insert into public.carts (id, user_id) values
  ('e1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111'),
  ('e2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222');

insert into public.addresses (
  id, user_id, recipient_name, phone, address_line1, city_municipality,
  province, postal_code
) values
  ('f1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Customer One', '0917', 'One Street', 'City', 'Province', '1000'),
  ('f2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Customer Two', '0918', 'Two Street', 'City', 'Province', '1000');

-- COD: reservation APIs and the order transition are exactly-once on retries.
select extensions.is(
  private.reserve_inventory(
    'c1111111-1111-1111-1111-111111111111',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 2, 'infinity'::timestamptz,
    'reserve-cod', null
  ),
  private.reserve_inventory(
    'c1111111-1111-1111-1111-111111111111',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 2, 'infinity'::timestamptz,
    'reserve-cod', null
  ),
  'exact reservation retry returns the original reservation'
);

select extensions.is(
  (select count(*) from public.inventory_reservations where idempotency_key = 'reserve-cod'),
  1::bigint,
  'reservation retry creates one row'
);

select extensions.throws_ok(
  $$
    select private.reserve_inventory(
      'c1111111-1111-1111-1111-111111111111',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 2, 'infinity'::timestamptz,
      'reserve-cod', '11111111-1111-1111-1111-111111111111'
    )
  $$,
  '23505', 'conflicting inventory reservation retry',
  'reservation retry rejects a changed persisted actor'
);

select extensions.is(
  private.transition_inventory_reservation(
    (select id from public.inventory_reservations where idempotency_key = 'reserve-cod'),
    'consumed', 'consume-cod', null, 'accepted COD order'
  ),
  'consumed', 'COD stock reservation can be consumed'
);

select extensions.is(
  private.transition_inventory_reservation(
    (select id from public.inventory_reservations where idempotency_key = 'reserve-cod'),
    'consumed', 'consume-cod', null, 'accepted COD order'
  ),
  'consumed', 'exact reservation transition retry is idempotent'
);

select extensions.throws_ok(
  $$
    select private.transition_inventory_reservation(
      (select id from public.inventory_reservations where idempotency_key = 'reserve-cod'),
      'consumed', 'consume-cod', null, 'changed reason'
    )
  $$,
  '23505', 'conflicting inventory transition retry',
  'reservation transition retry rejects a changed persisted reason'
);

select extensions.is(
  (select status from public.payments where id = 'd1111111-1111-1111-1111-111111111111'),
  'UNPAID', 'COD remains unpaid before fulfillment processing'
);

select extensions.is(
  (public.transition_order(
    'c1111111-1111-1111-1111-111111111111', 'PROCESSING', null, 'test', null,
    'cod-processing', '{}'::jsonb
  )).status,
  'PROCESSING', 'COD may process unpaid after its reservation is consumed'
);

select extensions.is(
  (public.transition_order(
    'c1111111-1111-1111-1111-111111111111', 'PROCESSING', null, 'test', null,
    'cod-processing', '{}'::jsonb
  )).status,
  'PROCESSING', 'exact order transition retry is idempotent'
);

select extensions.is(
  (select count(*) from public.order_status_history
   where order_id = 'c1111111-1111-1111-1111-111111111111'
     and idempotency_key = 'cod-processing'),
  1::bigint, 'order transition retry creates one history row'
);

select extensions.throws_ok(
  $$
    select public.transition_order(
      'c1111111-1111-1111-1111-111111111111', 'PROCESSING', null, 'test', null,
      'fresh-same-state', '{}'::jsonb
    )
  $$,
  '23514', 'order is already in status PROCESSING',
  'a fresh idempotency key cannot create a same-state order transition'
);

select extensions.throws_ok(
  $$
    select public.transition_order(
      'c1111111-1111-1111-1111-111111111111', 'CONFIRMED', null, 'test', null,
      'backward-transition', '{}'::jsonb
    )
  $$,
  '23514', 'invalid order transition: PROCESSING -> CONFIRMED',
  'backward order transition is forbidden'
);

do $$
begin
  perform public.transition_order('c1111111-1111-1111-1111-111111111111', 'PACKING', null, 'test', null, 'cod-packing', '{}'::jsonb);
  perform public.transition_order('c1111111-1111-1111-1111-111111111111', 'READY_FOR_SHIPMENT', null, 'test', null, 'cod-ready', '{}'::jsonb);
  perform public.transition_order('c1111111-1111-1111-1111-111111111111', 'SHIPPED', null, 'test', null, 'cod-shipped', '{}'::jsonb);
  perform public.transition_order('c1111111-1111-1111-1111-111111111111', 'OUT_FOR_DELIVERY', null, 'test', null, 'cod-out', '{}'::jsonb);
  perform public.transition_order('c1111111-1111-1111-1111-111111111111', 'DELIVERED', null, 'test', null, 'cod-delivered', '{}'::jsonb);
end
$$;

select extensions.is(
  private.settle_cod_payment(
    'd1111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222', 'cash received', 'cod-paid',
    '{"channel":"counter"}'::jsonb
  ),
  'PAID', 'trusted COD settlement records payment state'
);

select extensions.throws_ok(
  $$
    select private.settle_cod_payment(
      'd1111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222', 'cash received', 'cod-paid',
      '{"channel":"changed"}'::jsonb
    )
  $$,
  '23505', 'conflicting payment transition retry',
  'payment retry rejects changed persisted metadata'
);

select extensions.is(
  (public.transition_order(
    'c1111111-1111-1111-1111-111111111111', 'COMPLETED', 'order complete',
    'test', null, 'cod-completed', '{}'::jsonb
  )).status,
  'COMPLETED', 'paid delivered COD order can complete'
);

-- Manual GCash rejection keeps the order and stock retryable; correction is additive.
select extensions.ok(
  private.reserve_inventory(
    'c2222222-2222-2222-2222-222222222222',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 1, 'infinity'::timestamptz,
    'reserve-gcash', '11111111-1111-1111-1111-111111111111'
  ) is not null,
  'GCash checkout has an active reservation'
);

select extensions.throws_ok(
  $$
    select public.transition_order(
      'c2222222-2222-2222-2222-222222222222', 'CANCELLED', 'unsafe cancellation',
      'test', null, 'gcash-generic-cancel', '{}'::jsonb
    )
  $$,
  'P0001', 'active reservations require final resolution before cancellation',
  'generic order cancellation cannot orphan an active reservation'
);

select extensions.throws_ok(
  $$
    select private.submit_gcash_proof(
      'd2222222-2222-2222-2222-222222222222',
      '11111111-1111-1111-1111-111111111111', 10000, 'REF-BAD',
      '22222222-2222-2222-2222-222222222222/c2222222-2222-2222-2222-222222222222/11111111-aaaa-aaaa-aaaa-111111111111.webp',
      'infinity'::timestamptz, 'submission-bad-path', 'proof-event-bad-path'
    )
  $$,
  '22023', 'receipt path does not match submitter and order',
  'proof submission rejects a receipt path for another user'
);

select extensions.throws_ok(
  $$
    select private.submit_gcash_proof(
      'd2222222-2222-2222-2222-222222222222',
      '11111111-1111-1111-1111-111111111111', 10000, 'REF-MISSING',
      '11111111-1111-1111-1111-111111111111/c2222222-2222-2222-2222-222222222222/99999999-aaaa-aaaa-aaaa-999999999999.webp',
      'infinity'::timestamptz, 'submission-missing', 'proof-event-missing'
    )
  $$,
  'P0002', 'receipt object not found',
  'proof submission requires the canonical storage object to exist'
);

insert into storage.objects (bucket_id, name, owner_id, metadata)
values (
  'payment-receipts',
  '11111111-1111-1111-1111-111111111111/c2222222-2222-2222-2222-222222222222/88888888-aaaa-aaaa-aaaa-888888888888.webp',
  '11111111-1111-1111-1111-111111111111',
  '{"size":2097153,"mimetype":"image/webp"}'::jsonb
);

select extensions.throws_ok(
  $$
    select private.submit_gcash_proof(
      'd2222222-2222-2222-2222-222222222222',
      '11111111-1111-1111-1111-111111111111', 10000, 'REF-BIG',
      '11111111-1111-1111-1111-111111111111/c2222222-2222-2222-2222-222222222222/88888888-aaaa-aaaa-aaaa-888888888888.webp',
      'infinity'::timestamptz, 'submission-big', 'proof-event-big'
    )
  $$,
  '22023', 'receipt object metadata is invalid',
  'proof submission rejects an object with out-of-contract declared metadata'
);

insert into storage.objects (bucket_id, name, owner_id, metadata)
values
  ('payment-receipts', '11111111-1111-1111-1111-111111111111/c2222222-2222-2222-2222-222222222222/11111111-aaaa-aaaa-aaaa-111111111111.webp', '11111111-1111-1111-1111-111111111111', '{"size":100,"mimetype":"image/webp"}'::jsonb),
  ('payment-receipts', '11111111-1111-1111-1111-111111111111/c2222222-2222-2222-2222-222222222222/22222222-aaaa-aaaa-aaaa-222222222222.webp', '11111111-1111-1111-1111-111111111111', '{"size":100,"mimetype":"image/webp"}'::jsonb),
  ('payment-receipts', '11111111-1111-1111-1111-111111111111/c2222222-2222-2222-2222-222222222222/33333333-aaaa-aaaa-aaaa-333333333333.webp', null, '{"size":100,"mimetype":"image/webp"}'::jsonb),
  ('payment-receipts', '11111111-1111-1111-1111-111111111111/c2222222-2222-2222-2222-222222222222/44444444-aaaa-aaaa-aaaa-444444444444.webp', '22222222-2222-2222-2222-222222222222', '{"size":100,"mimetype":"image/webp"}'::jsonb),
  ('payment-receipts', '11111111-1111-1111-1111-111111111111/c2222222-2222-2222-2222-222222222222/55555555-aaaa-aaaa-aaaa-555555555555.png', '11111111-1111-1111-1111-111111111111', '{"size":100,"mimetype":"image/webp"}'::jsonb);

select extensions.throws_ok(
  $$
    select private.submit_gcash_proof(
      'd2222222-2222-2222-2222-222222222222',
      '11111111-1111-1111-1111-111111111111', 10000, 'REF-OWNERLESS',
      '11111111-1111-1111-1111-111111111111/c2222222-2222-2222-2222-222222222222/33333333-aaaa-aaaa-aaaa-333333333333.webp',
      '2100-02-01 00:00:00+00'::timestamptz, 'submission-ownerless', 'proof-event-ownerless'
    )
  $$,
  '42501', 'receipt object owner does not match submitter',
  'proof submission rejects an ownerless receipt object'
);

select extensions.throws_ok(
  $$
    select private.submit_gcash_proof(
      'd2222222-2222-2222-2222-222222222222',
      '11111111-1111-1111-1111-111111111111', 10000, 'REF-WRONG-OWNER',
      '11111111-1111-1111-1111-111111111111/c2222222-2222-2222-2222-222222222222/44444444-aaaa-aaaa-aaaa-444444444444.webp',
      '2100-02-01 00:00:00+00'::timestamptz, 'submission-wrong-owner', 'proof-event-wrong-owner'
    )
  $$,
  '42501', 'receipt object owner does not match submitter',
  'proof submission rejects a receipt object owned by another user'
);

select extensions.throws_ok(
  $$
    select private.submit_gcash_proof(
      'd2222222-2222-2222-2222-222222222222',
      '11111111-1111-1111-1111-111111111111', 10000, 'REF-MIME-MISMATCH',
      '11111111-1111-1111-1111-111111111111/c2222222-2222-2222-2222-222222222222/55555555-aaaa-aaaa-aaaa-555555555555.png',
      '2100-02-01 00:00:00+00'::timestamptz, 'submission-mime-mismatch', 'proof-event-mime-mismatch'
    )
  $$,
  '22023', 'receipt extension does not match MIME type',
  'proof submission requires the extension to match the declared MIME type'
);

select extensions.ok(
  private.submit_gcash_proof(
    'd2222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111', 10000, 'REF-1',
    '11111111-1111-1111-1111-111111111111/c2222222-2222-2222-2222-222222222222/11111111-aaaa-aaaa-aaaa-111111111111.webp',
    '2100-02-01 00:00:00+00'::timestamptz, 'submission-1', 'proof-event-1'
  ) is not null,
  'customer can submit the first GCash proof through the trusted flow'
);

select extensions.is(
  private.submit_gcash_proof(
    'd2222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111', 10000, 'REF-1',
    '11111111-1111-1111-1111-111111111111/c2222222-2222-2222-2222-222222222222/11111111-aaaa-aaaa-aaaa-111111111111.webp',
    '2100-02-01 00:00:00+00'::timestamptz, 'submission-1', 'proof-event-1'
  ),
  (select id from public.payment_submissions where idempotency_key = 'submission-1'),
  'exact proof submission retry returns the original row'
);

select extensions.throws_ok(
  $$
    select private.submit_gcash_proof(
      'd2222222-2222-2222-2222-222222222222',
      '11111111-1111-1111-1111-111111111111', 10000, 'REF-1',
      '11111111-1111-1111-1111-111111111111/c2222222-2222-2222-2222-222222222222/11111111-aaaa-aaaa-aaaa-111111111111.webp',
      pg_catalog.now() + interval '1 day', 'submission-1', 'proof-event-1'
    )
  $$,
  '23505', 'conflicting GCash proof retry',
  'proof retry rejects a changed persisted reservation expiry'
);

select extensions.throws_ok(
  $$
    select private.reject_gcash_submission(
      'd2222222-2222-2222-2222-222222222222',
      (select id from public.payment_submissions where idempotency_key = 'submission-1'),
      '11111111-1111-1111-1111-111111111111', 'Unauthorized review', 'unauthorized-review'
    )
  $$,
  '42501', 'payment reviewer role required',
  'customer cannot perform a payment review'
);

select extensions.throws_ok(
  $$
    select private.start_gcash_review(
      'd2222222-2222-2222-2222-222222222222',
      (select id from public.payment_submissions where idempotency_key = 'submission-1'),
      '11111111-1111-1111-1111-111111111111', 'unauthorized-review-start'
    )
  $$,
  '42501', 'payment reviewer role required',
  'customer cannot start payment review'
);

select extensions.is(
  private.start_gcash_review(
    'd2222222-2222-2222-2222-222222222222',
    (select id from public.payment_submissions where idempotency_key = 'submission-1'),
    '22222222-2222-2222-2222-222222222222', 'review-start-1'
  ),
  'VERIFYING', 'reviewer can start verification of submitted GCash proof'
);

select extensions.is(
  private.reject_gcash_submission(
    'd2222222-2222-2222-2222-222222222222',
    (select id from public.payment_submissions where idempotency_key = 'submission-1'),
    '22222222-2222-2222-2222-222222222222', 'Unreadable receipt', 'reject-1'
  ),
  'REJECTED', 'reviewer can reject GCash proof'
);

select extensions.throws_ok(
  $$
    update public.payment_submissions
    set rejection_reason = 'Rewritten reason',
        reviewed_by = '33333333-3333-3333-3333-333333333333'
    where idempotency_key = 'submission-1'
  $$,
  '55000', 'terminal payment review is immutable',
  'rejected payment submission review cannot be rewritten'
);

select extensions.is(
  private.reject_gcash_submission(
    'd2222222-2222-2222-2222-222222222222',
    (select id from public.payment_submissions where idempotency_key = 'submission-1'),
    '22222222-2222-2222-2222-222222222222', 'Unreadable receipt', 'reject-1'
  ),
  'REJECTED', 'exact GCash rejection retry is idempotent'
);

select extensions.is(
  private.transition_payment(
    'd2222222-2222-2222-2222-222222222222', 'VERIFYING', 'review-start-1',
    '22222222-2222-2222-2222-222222222222',
    (select id from public.payment_submissions where idempotency_key = 'submission-1')
  ),
  'VERIFYING', 'exact payment transition retry returns its historical result after rejection'
);

select extensions.results_eq(
  $$
    select o.status, p.status, r.status
    from public.orders o
    join public.payments p on p.order_id = o.id
    join public.inventory_reservations r on r.order_id = o.id
    where o.id = 'c2222222-2222-2222-2222-222222222222'
  $$,
  $$ values ('CONFIRMED'::text, 'REJECTED'::text, 'active'::text) $$,
  'normal GCash rejection leaves order confirmed and reservation active'
);

select extensions.ok(
  private.submit_gcash_proof(
    'd2222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111', 10000, 'REF-2',
    '11111111-1111-1111-1111-111111111111/c2222222-2222-2222-2222-222222222222/22222222-aaaa-aaaa-aaaa-222222222222.webp',
    '2100-03-01 00:00:00+00'::timestamptz, 'submission-2', 'proof-event-2'
  ) is not null,
  'corrected GCash proof creates a new submission'
);

select extensions.is(
  private.submit_gcash_proof(
    'd2222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111', 10000, 'REF-2',
    '11111111-1111-1111-1111-111111111111/c2222222-2222-2222-2222-222222222222/22222222-aaaa-aaaa-aaaa-222222222222.webp',
    '2100-03-01 00:00:00+00'::timestamptz, 'submission-2', 'proof-event-2'
  ),
  (select id from public.payment_submissions where idempotency_key = 'submission-2'),
  'exact corrected-proof retry is idempotent'
);

select extensions.is(
  private.reject_gcash_submission(
    'd2222222-2222-2222-2222-222222222222',
    (select id from public.payment_submissions where idempotency_key = 'submission-1'),
    '22222222-2222-2222-2222-222222222222', 'Unreadable receipt', 'reject-1'
  ),
  'REJECTED', 'exact original rejection retry succeeds after corrected proof exists'
);

select extensions.is(
  private.submit_gcash_proof(
    'd2222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111', 10000, 'REF-1',
    '11111111-1111-1111-1111-111111111111/c2222222-2222-2222-2222-222222222222/11111111-aaaa-aaaa-aaaa-111111111111.webp',
    '2100-02-01 00:00:00+00'::timestamptz, 'submission-1', 'proof-event-1'
  ),
  (select id from public.payment_submissions where idempotency_key = 'submission-1'),
  'exact original proof retry succeeds after corrected proof changes the reservation expiry'
);

select extensions.results_eq(
  $$
    select review_status, rejection_reason
    from public.payment_submissions
    where idempotency_key = 'submission-1'
  $$,
  $$ values ('REJECTED'::text, 'Unreadable receipt'::text) $$,
  'resubmission preserves the prior rejected evidence row'
);

select extensions.results_eq(
  $$
    select p.status, r.status, count(s.id)
    from public.payments p
    join public.inventory_reservations r on r.order_id = p.order_id
    join public.payment_submissions s on s.payment_id = p.id
    where p.id = 'd2222222-2222-2222-2222-222222222222'
    group by p.status, r.status
  $$,
  $$ values ('SUBMITTED'::text, 'active'::text, 2::bigint) $$,
  'corrected proof resubmits payment while retaining active stock and both proofs'
);

-- A later terminal reservation must roll back all earlier GCash approval work.
insert into public.product_variants (id, product_id, sku, price_minor)
values
  ('80000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'ROLLBACK-FIRST', 10000),
  ('90000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'ROLLBACK-LATER', 10000);

insert into public.inventory (variant_id, on_hand)
values
  ('80000000-0000-0000-0000-000000000001', 5),
  ('90000000-0000-0000-0000-000000000001', 5);

select public.checkout_order(
  '33333333-3333-3333-3333-333333333333', 'checkout-gcash-rollback',
  '[{"variant_id":"80000000-0000-0000-0000-000000000001","quantity":1},{"variant_id":"90000000-0000-0000-0000-000000000001","quantity":1}]'::jsonb,
  0, 'MANUAL_GCASH', '2100-04-01 00:00:00+00'::timestamptz,
  '{"customer_email":"super@example.test","recipient_name":"Rollback","recipient_phone":"1","address_line1":"Street","city_municipality":"City","province":"Province","postal_code":"1000"}'::jsonb,
  null
);

insert into storage.objects (bucket_id, name, owner_id, metadata)
select 'payment-receipts',
       '33333333-3333-3333-3333-333333333333/' || o.id::text || '/99999999-aaaa-aaaa-aaaa-999999999999.webp',
       '33333333-3333-3333-3333-333333333333', '{"size":100,"mimetype":"image/webp"}'::jsonb
from public.orders o where o.idempotency_key = 'checkout-gcash-rollback';

select private.submit_gcash_proof(
  (select p.id from public.payments p join public.orders o on o.id = p.order_id
   where o.idempotency_key = 'checkout-gcash-rollback'),
  '33333333-3333-3333-3333-333333333333', 20000, 'ROLLBACK-REF',
  (select '33333333-3333-3333-3333-333333333333/' || o.id::text || '/99999999-aaaa-aaaa-aaaa-999999999999.webp'
   from public.orders o where o.idempotency_key = 'checkout-gcash-rollback'),
  '2100-04-02 00:00:00+00'::timestamptz, 'rollback-submission', 'rollback-proof-event'
);

select private.transition_inventory_reservation(
  (select r.id from public.inventory_reservations r join public.orders o on o.id = r.order_id
   where o.idempotency_key = 'checkout-gcash-rollback'
     and r.variant_id = '90000000-0000-0000-0000-000000000001'),
  'released', 'rollback-later-release', '22222222-2222-2222-2222-222222222222',
  'test later-reservation failure'
);

select extensions.throws_ok(
  $$
    select private.approve_gcash_submission(
      (select p.id from public.payments p join public.orders o on o.id = p.order_id
       where o.idempotency_key = 'checkout-gcash-rollback'),
      (select id from public.payment_submissions where idempotency_key = 'rollback-submission'),
      '22222222-2222-2222-2222-222222222222', 'rollback-approval', 'amount verified'
    )
  $$,
  'P0001', 'reservation is already terminal in status released',
  'GCash approval fails after reaching the later non-consumable reservation'
);

select extensions.results_eq(
  $$
    select p.status, s.review_status, i.on_hand, i.reserved, r.status,
           r.terminal_at is null,
           (select count(*) from public.inventory_movements m where m.reservation_id = r.id),
           (select count(*) from public.inventory_movements m
            join public.inventory_reservations ar on ar.id = m.reservation_id
            where ar.order_id = o.id),
           (select count(*) from public.payment_events e where e.payment_id = p.id),
           (select count(*) from public.payment_events e
            where e.payment_id = p.id and e.idempotency_key = 'rollback-approval'),
           (select count(*) from public.audit_logs a
            where a.entity_id = p.id and a.action = 'payment.gcash_approved')
    from public.orders o
    join public.payments p on p.order_id = o.id
    join public.payment_submissions s on s.payment_id = p.id and s.idempotency_key = 'rollback-submission'
    join public.inventory_reservations r on r.order_id = o.id
      and r.variant_id = '80000000-0000-0000-0000-000000000001'
    join public.inventory i on i.variant_id = r.variant_id
    where o.idempotency_key = 'checkout-gcash-rollback'
  $$,
  $$ values ('SUBMITTED'::text, 'PENDING'::text, 5, 1, 'active'::text, true,
             1::bigint, 3::bigint, 2::bigint, 0::bigint, 0::bigint) $$,
  'failed multi-reservation approval leaves payment, evidence, first stock, movements, events, and audit exactly pre-attempt'
);

select extensions.is(
  private.approve_gcash_submission(
    'd2222222-2222-2222-2222-222222222222',
    (select id from public.payment_submissions where idempotency_key = 'submission-2'),
    '22222222-2222-2222-2222-222222222222', 'approve-2', 'amount verified'
  ),
  'PAID', 'GCash approval executes the trusted approval operation'
);

select extensions.throws_ok(
  $$
    update public.payment_submissions
    set reviewed_by = '33333333-3333-3333-3333-333333333333'
    where idempotency_key = 'submission-2'
  $$,
  '55000', 'terminal payment review is immutable',
  'approved payment submission review cannot be rewritten'
);

select extensions.results_eq(
  $$
    select p.status, s.review_status, r.status,
           (select count(*) from public.payment_events e
            where e.payment_id = p.id and e.idempotency_key = 'approve-2'),
           (select count(*) from public.audit_logs a
            where a.entity_id = p.id and a.action = 'payment.gcash_approved')
    from public.payments p
    join public.payment_submissions s on s.payment_id = p.id and s.idempotency_key = 'submission-2'
    join public.inventory_reservations r on r.order_id = p.order_id
    where p.id = 'd2222222-2222-2222-2222-222222222222'
  $$,
  $$ values ('PAID'::text, 'APPROVED'::text, 'consumed'::text, 1::bigint, 1::bigint) $$,
  'GCash approval consumes the reservation and records paid evidence exactly once'
);

select extensions.is(
  private.approve_gcash_submission(
    'd2222222-2222-2222-2222-222222222222',
    (select id from public.payment_submissions where idempotency_key = 'submission-2'),
    '22222222-2222-2222-2222-222222222222', 'approve-2', 'amount verified'
  ),
  'PAID', 'exact GCash approval retry is idempotent'
);

select extensions.throws_ok(
  $$ update public.order_status_history set note = 'append-only-tamper' where idempotency_key = 'cod-processing' $$,
  '55000', 'order_status_history is append-only',
  'order status history rejects updates'
);
select extensions.is(
  (select count(*) from public.order_status_history where note = 'append-only-tamper'),
  0::bigint, 'failed order status history update leaves data unchanged'
);
select extensions.throws_ok(
  $$ update public.inventory_movements set reason = 'append-only-tamper' where id = (select id from public.inventory_movements order by created_at limit 1) $$,
  '55000', 'inventory_movements is append-only',
  'inventory movements reject updates'
);
select extensions.is(
  (select count(*) from public.inventory_movements where reason = 'append-only-tamper'),
  0::bigint, 'failed inventory movement update leaves data unchanged'
);
select extensions.throws_ok(
  $$ update public.payment_events set reason = 'append-only-tamper' where idempotency_key = 'approve-2' $$,
  '55000', 'payment_events is append-only',
  'payment events reject updates'
);
select extensions.is(
  (select count(*) from public.payment_events where reason = 'append-only-tamper'),
  0::bigint, 'failed payment event update leaves data unchanged'
);
select extensions.throws_ok(
  $$ update public.audit_logs set request_id = 'append-only-tamper' where action = 'payment.gcash_approved' $$,
  '55000', 'audit_logs is append-only',
  'audit logs reject updates'
);
select extensions.is(
  (select count(*) from public.audit_logs where request_id = 'append-only-tamper'),
  0::bigint, 'failed audit log update leaves data unchanged'
);

select public.checkout_order(
  '22222222-2222-2222-2222-222222222222', 'checkout-timeout',
  '[{"variant_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","quantity":1}]'::jsonb,
  0, 'MANUAL_GCASH', pg_catalog.now() + interval '1 hour',
  '{"customer_email":"customer2@example.test","recipient_name":"Timeout","recipient_phone":"1","address_line1":"Street","city_municipality":"City","province":"Province","postal_code":"1000"}'::jsonb,
  null
);
update public.inventory_reservations set expires_at = pg_catalog.now() - interval '1 second'
where order_id = (select id from public.orders where idempotency_key = 'checkout-timeout');

select extensions.is(
  private.close_expired_gcash_payment(
    (select p.id from public.payments p join public.orders o on o.id = p.order_id
     where o.idempotency_key = 'checkout-timeout'),
    '22222222-2222-2222-2222-222222222222', 'proof window closed', 'close-timeout'
  ),
  'FAILED', 'expired unpaid no-proof GCash attempt closes through the trusted operation'
);

select extensions.ok(
  (select o.status = 'CANCELLED' and p.status = 'FAILED' and r.status = 'expired'
          and exists (select 1 from public.order_status_history h where h.order_id = o.id and h.to_status = 'CANCELLED')
          and exists (select 1 from public.payment_events e where e.payment_id = p.id and e.idempotency_key = 'close-timeout')
          and exists (select 1 from public.audit_logs a where a.entity_id = p.id and a.action = 'payment.timeout_closed')
   from public.orders o join public.payments p on p.order_id = o.id
   join public.inventory_reservations r on r.order_id = o.id
   where o.idempotency_key = 'checkout-timeout'),
  'timeout closure atomically releases stock, fails payment, cancels order, and records ledgers'
);

select extensions.is(
  private.close_expired_gcash_payment(
    (select p.id from public.payments p join public.orders o on o.id = p.order_id
     where o.idempotency_key = 'checkout-timeout'),
    '22222222-2222-2222-2222-222222222222', 'proof window closed', 'close-timeout'
  ),
  'FAILED', 'exact timeout closure retry is idempotent'
);

select public.checkout_order(
  '22222222-2222-2222-2222-222222222222', 'checkout-final-rejection',
  '[{"variant_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","quantity":1}]'::jsonb,
  0, 'MANUAL_GCASH', pg_catalog.now() + interval '1 hour',
  '{"customer_email":"customer2@example.test","recipient_name":"Final rejection","recipient_phone":"1","address_line1":"Street","city_municipality":"City","province":"Province","postal_code":"1000"}'::jsonb,
  null
);
insert into storage.objects (bucket_id, name, owner_id, metadata)
select 'payment-receipts',
       '22222222-2222-2222-2222-222222222222/' || o.id::text || '/66666666-aaaa-aaaa-aaaa-666666666666.webp',
       '22222222-2222-2222-2222-222222222222', '{"size":100,"mimetype":"image/webp"}'::jsonb
from public.orders o where o.idempotency_key = 'checkout-final-rejection';
select private.submit_gcash_proof(
  (select p.id from public.payments p join public.orders o on o.id = p.order_id
   where o.idempotency_key = 'checkout-final-rejection'),
  '22222222-2222-2222-2222-222222222222', 10000, 'FINAL-REF',
  (select '22222222-2222-2222-2222-222222222222/' || o.id::text || '/66666666-aaaa-aaaa-aaaa-666666666666.webp'
   from public.orders o where o.idempotency_key = 'checkout-final-rejection'),
  pg_catalog.now() + interval '1 day', 'final-submission', 'final-proof-event'
);
update public.inventory_reservations set expires_at = pg_catalog.now() - interval '1 second'
where order_id = (select id from public.orders where idempotency_key = 'checkout-final-rejection');

select extensions.is(
  private.reject_gcash_submission(
    (select p.id from public.payments p join public.orders o on o.id = p.order_id
     where o.idempotency_key = 'checkout-final-rejection'),
    (select id from public.payment_submissions where idempotency_key = 'final-submission'),
    '22222222-2222-2222-2222-222222222222', 'proof rejected after deadline', 'final-reject'
  ),
  'REJECTED', 'authorized reviewer can finally reject overdue submitted evidence'
);

select extensions.ok(
  (select o.status = 'CANCELLED' and p.status = 'REJECTED'
          and s.review_status = 'REJECTED' and r.status = 'expired'
          and exists (select 1 from public.order_status_history h where h.order_id = o.id and h.source = 'gcash_rejection')
          and exists (select 1 from public.payment_events e where e.payment_id = p.id and e.idempotency_key = 'final-reject' and e.metadata = '{"final_resolution":true}'::jsonb)
          and exists (select 1 from public.audit_logs a where a.entity_id = p.id and a.action = 'payment.gcash_rejected')
   from public.orders o join public.payments p on p.order_id = o.id
   join public.payment_submissions s on s.payment_id = p.id
   join public.inventory_reservations r on r.order_id = o.id
   where o.idempotency_key = 'checkout-final-rejection'),
  'final rejection atomically rejects evidence, releases stock, cancels order, and records ledgers'
);

select extensions.is(
  private.reject_gcash_submission(
    (select p.id from public.payments p join public.orders o on o.id = p.order_id
     where o.idempotency_key = 'checkout-final-rejection'),
    (select id from public.payment_submissions where idempotency_key = 'final-submission'),
    '22222222-2222-2222-2222-222222222222', 'proof rejected after deadline', 'final-reject'
  ),
  'REJECTED', 'exact final rejection retry is idempotent from its immutable event'
);

-- Customer 1 session: owner reads work, cross-tenant reads/writes do not.
select pg_catalog.set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;

select extensions.is((select count(*) from public.profiles), 1::bigint, 'customer sees only their profile');
select extensions.is(
  (select count(*) from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  0::bigint, 'customer cannot read another profile'
);
select extensions.is((select count(*) from public.orders), 2::bigint, 'customer sees their own orders');
select extensions.is(
  (select count(*) from public.orders where id = 'c3333333-3333-3333-3333-333333333333'),
  0::bigint, 'customer cannot read another order'
);
select extensions.is((select count(*) from public.payments), 2::bigint, 'customer sees payments for their own orders');
select extensions.is(
  (select count(*) from public.payments where id = 'd3333333-3333-3333-3333-333333333333'),
  0::bigint, 'customer cannot read another payment'
);
select extensions.is(
  (select count(*) from public.carts where id = 'e2222222-2222-2222-2222-222222222222'),
  0::bigint, 'customer cannot read another cart'
);
select extensions.is(
  (select count(*) from public.addresses where id = 'f2222222-2222-2222-2222-222222222222'),
  0::bigint, 'customer cannot read another address'
);

select extensions.lives_ok(
  $$
    do $block$
    begin
      update public.addresses set label = 'stolen'
      where id = 'f2222222-2222-2222-2222-222222222222';
      if found then
        raise exception 'cross-tenant row was updated';
      end if;
    end
    $block$
  $$,
  'customer cannot update another address'
);

select extensions.throws_ok(
  $$
    insert into public.cart_items (cart_id, variant_id, quantity)
    values (
      'e2222222-2222-2222-2222-222222222222',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 1
    )
  $$,
  '42501', 'new row violates row-level security policy for table "cart_items"',
  'customer cannot insert into another cart'
);

select extensions.throws_ok(
  $$ insert into public.inventory (variant_id) values ('99999999-9999-9999-9999-999999999999') $$,
  '42501', 'permission denied for table inventory', 'customer cannot write inventory'
);

select extensions.throws_ok(
  $$ update public.product_variants set price_minor = 1 where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' $$,
  '42501', 'permission denied for table product_variants', 'customer cannot update product prices'
);

select extensions.throws_ok(
  $$
    insert into public.order_status_history (order_id, to_status, source, idempotency_key)
    values ('c1111111-1111-1111-1111-111111111111', 'CONFIRMED', 'browser', 'browser-history')
  $$,
  '42501', 'permission denied for table order_status_history', 'customer cannot insert order history'
);

select extensions.throws_ok(
  $$
    insert into public.payment_events (payment_id, event_type, to_status, idempotency_key)
    values ('d1111111-1111-1111-1111-111111111111', 'PAYMENT_CREATED', 'UNPAID', 'browser-payment-event')
  $$,
  '42501', 'permission denied for table payment_events', 'customer cannot insert payment events'
);

select extensions.throws_ok(
  $$
    insert into public.inventory_movements (
      variant_id, movement_type, on_hand_delta, on_hand_after, reserved_after, idempotency_key
    ) values (
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'adjustment', 1, 1, 0, 'browser-inventory-movement'
    )
  $$,
  '42501', 'permission denied for table inventory_movements', 'customer cannot insert inventory movements'
);

select extensions.throws_ok(
  $$ update public.orders set status = 'PROCESSING' where id = 'c1111111-1111-1111-1111-111111111111' $$,
  '42501', 'permission denied for table orders', 'customer cannot change order status'
);

select extensions.throws_ok(
  $$ update public.payments set status = 'PAID' where id = 'd1111111-1111-1111-1111-111111111111' $$,
  '42501', 'permission denied for table payments', 'customer cannot set payment state'
);

select extensions.throws_ok(
  $$ insert into public.audit_logs (action, entity) values ('tamper', 'audit') $$,
  '42501', 'permission denied for table audit_logs', 'customer cannot write audit logs'
);

select extensions.throws_ok(
  $$
    select public.checkout_order(
      '11111111-1111-1111-1111-111111111111', 'browser-checkout',
      '[{"variant_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","quantity":1}]'::jsonb,
      0, 'COD', null,
      '{"customer_email":"customer1@example.test","recipient_name":"Browser","recipient_phone":"1","address_line1":"Street","city_municipality":"City","province":"Province","postal_code":"1000"}'::jsonb,
      null
    )
  $$,
  '42501', null, 'authenticated browser cannot execute authoritative checkout'
);

select extensions.throws_ok(
  $$
    select private.reserve_inventory(
      'c1111111-1111-1111-1111-111111111111',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 1, 'infinity', 'browser-reserve'
    )
  $$,
  '42501', null, 'authenticated browser cannot execute inventory helpers'
);

select extensions.throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('product-images', 'products/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.webp') $$,
  '42501', null, 'authenticated admin-shaped sessions cannot directly write product objects'
);

select extensions.throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('payment-receipts', '11111111-1111-1111-1111-111111111111/c1111111-1111-1111-1111-111111111111/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.webp') $$,
  '42501', null, 'authenticated users cannot directly insert receipt objects'
);

select extensions.is(
  (select count(*) from storage.objects where bucket_id = 'payment-receipts'),
  0::bigint, 'authenticated users cannot directly read private receipt objects'
);

select extensions.ok(
  not exists (
    select 1
    from unnest(array[
      'public.inventory', 'public.inventory_movements', 'public.inventory_reservations',
      'public.orders', 'public.order_items', 'public.order_status_history',
      'public.payments', 'public.payment_submissions', 'public.payment_events',
      'public.audit_logs'
    ]) as protected(table_name)
    where has_table_privilege('authenticated', protected.table_name, 'INSERT')
       or has_table_privilege('authenticated', protected.table_name, 'UPDATE')
       or has_table_privilege('authenticated', protected.table_name, 'DELETE')
  ),
  'authenticated has no direct DML on inventory, order, payment, or audit domains'
);

select extensions.ok(
  not has_table_privilege('authenticated', 'private.user_roles', 'SELECT'),
  'customer cannot read the private role table'
);

reset role;

-- Auth deletion may null only approved historical actor references.
insert into auth.users (
  id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  (
    '55555555-5555-5555-5555-555555555555',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'lifecycle@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '66666666-6666-6666-6666-666666666666',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'replacement@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
  );

update public.orders
set user_id = '55555555-5555-5555-5555-555555555555'
where id = 'c1111111-1111-1111-1111-111111111111';

insert into public.order_status_history (
  id, order_id, from_status, to_status, note, source, changed_by, idempotency_key
) values (
  '51111111-1111-1111-1111-111111111111',
  'c1111111-1111-1111-1111-111111111111', 'CONFIRMED', 'CANCELLED',
  'Lifecycle snapshot', 'lifecycle-test',
  '55555555-5555-5555-5555-555555555555', 'lifecycle-history'
);

insert into public.inventory_movements (
  id, variant_id, movement_type, on_hand_delta, reserved_delta,
  on_hand_after, reserved_after, actor_id, idempotency_key, reason
)
select
  '52222222-2222-2222-2222-222222222222', i.variant_id, 'adjustment',
  1, 0, i.on_hand + 1, i.reserved,
  '55555555-5555-5555-5555-555555555555', 'lifecycle-inventory',
  'Lifecycle snapshot'
from public.inventory as i
where i.variant_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

insert into public.payment_submissions (
  id, payment_id, submitted_by, claimed_amount_minor, reference_number,
  receipt_storage_path, review_status, reviewed_by, reviewed_at,
  rejection_reason, idempotency_key
) values (
  '56666666-6666-6666-6666-666666666666',
  'd1111111-1111-1111-1111-111111111111',
  '55555555-5555-5555-5555-555555555555', 20000, 'LIFECYCLE',
  'lifecycle/rejected.webp', 'REJECTED',
  '55555555-5555-5555-5555-555555555555', now(), 'Lifecycle rejection',
  'lifecycle-submission'
);

insert into public.payment_events (
  id, payment_id, submission_id, event_type, from_status, to_status,
  actor_id, reason, idempotency_key
) values (
  '53333333-3333-3333-3333-333333333333',
  'd1111111-1111-1111-1111-111111111111',
  '56666666-6666-6666-6666-666666666666', 'PROOF_REJECTED',
  'VERIFYING', 'REJECTED', '55555555-5555-5555-5555-555555555555',
  'Lifecycle snapshot', 'lifecycle-payment-event'
);

insert into public.audit_logs (
  id, actor_id, actor_role, action, entity, entity_id, metadata
) values (
  '54444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555555', 'customer',
  'lifecycle.snapshot', 'lifecycle',
  '55555555-5555-5555-5555-555555555555', '{"preserved":true}'::jsonb
);

create temp table lifecycle_snapshots (relation_name text primary key, row_data jsonb);
insert into lifecycle_snapshots values
  ('order_status_history', (select to_jsonb(h) from public.order_status_history as h where id = '51111111-1111-1111-1111-111111111111')),
  ('inventory_movements', (select to_jsonb(m) from public.inventory_movements as m where id = '52222222-2222-2222-2222-222222222222')),
  ('payment_events', (select to_jsonb(e) from public.payment_events as e where id = '53333333-3333-3333-3333-333333333333')),
  ('audit_logs', (select to_jsonb(a) from public.audit_logs as a where id = '54444444-4444-4444-4444-444444444444')),
  ('payment_submissions', (select to_jsonb(s) from public.payment_submissions as s where id = '56666666-6666-6666-6666-666666666666')),
  ('order', (select to_jsonb(o) from public.orders as o where id = 'c1111111-1111-1111-1111-111111111111')),
  ('payment', (select to_jsonb(p) from public.payments as p where id = 'd1111111-1111-1111-1111-111111111111'));

select extensions.throws_ok(
  $$ update public.order_status_history set changed_by = '66666666-6666-6666-6666-666666666666' where id = '51111111-1111-1111-1111-111111111111' $$,
  '55000', 'order_status_history is append-only', 'historical actor UUID cannot be replaced'
);
select extensions.throws_ok(
  $$ update public.inventory_movements set actor_id = null, reason = 'Tampered' where id = '52222222-2222-2222-2222-222222222222' $$,
  '55000', 'inventory_movements is append-only', 'actor nullification cannot include another ledger mutation'
);
select extensions.throws_ok(
  $$ update public.payment_submissions set submitted_by = '66666666-6666-6666-6666-666666666666' where id = '56666666-6666-6666-6666-666666666666' $$,
  '55000', 'payment submission evidence is immutable', 'payment submitter UUID cannot be replaced'
);
select extensions.throws_ok(
  $$ update public.payment_submissions set submitted_by = null, claimed_amount_minor = 1 where id = '56666666-6666-6666-6666-666666666666' $$,
  '55000', 'payment submission evidence is immutable', 'actor nullification cannot alter payment evidence'
);

select extensions.lives_ok(
  $$ delete from auth.users where id = '55555555-5555-5555-5555-555555555555' $$,
  'auth user deletion succeeds with retained commerce history'
);
select extensions.is(
  (select count(*) from public.profiles where id = '55555555-5555-5555-5555-555555555555')
  + (select count(*) from private.user_roles where user_id = '55555555-5555-5555-5555-555555555555'),
  0::bigint, 'identity-adjacent profile and roles cascade on auth deletion'
);
select extensions.ok(
  (select changed_by is null and to_jsonb(h) - 'changed_by' = s.row_data - 'changed_by'
   from public.order_status_history as h cross join lifecycle_snapshots as s
   where h.id = '51111111-1111-1111-1111-111111111111' and s.relation_name = 'order_status_history'),
  'order history survives with only changed_by nullified'
);
select extensions.ok(
  (select actor_id is null and to_jsonb(m) - 'actor_id' = s.row_data - 'actor_id'
   from public.inventory_movements as m cross join lifecycle_snapshots as s
   where m.id = '52222222-2222-2222-2222-222222222222' and s.relation_name = 'inventory_movements'),
  'inventory movement survives with only actor_id nullified'
);
select extensions.ok(
  (select actor_id is null and to_jsonb(e) - 'actor_id' = s.row_data - 'actor_id'
   from public.payment_events as e cross join lifecycle_snapshots as s
   where e.id = '53333333-3333-3333-3333-333333333333' and s.relation_name = 'payment_events'),
  'payment event survives with only actor_id nullified'
);
select extensions.ok(
  (select actor_id is null and to_jsonb(a) - 'actor_id' = s.row_data - 'actor_id'
   from public.audit_logs as a cross join lifecycle_snapshots as s
   where a.id = '54444444-4444-4444-4444-444444444444' and s.relation_name = 'audit_logs'),
  'audit row survives with only actor_id nullified'
);
select extensions.ok(
  (select submitted_by is null and reviewed_by is null
     and to_jsonb(ps) - array['submitted_by', 'reviewed_by']
         = s.row_data - array['submitted_by', 'reviewed_by']
   from public.payment_submissions as ps cross join lifecycle_snapshots as s
   where ps.id = '56666666-6666-6666-6666-666666666666' and s.relation_name = 'payment_submissions'),
  'payment submission survives with only actor references nullified'
);
select extensions.ok(
  (select o.user_id is null and o.status = s.row_data ->> 'status'
     and o.total_minor = (s.row_data ->> 'total_minor')::bigint
   from public.orders as o cross join lifecycle_snapshots as s
   where o.id = 'c1111111-1111-1111-1111-111111111111' and s.relation_name = 'order'),
  'order snapshot and financial total survive auth deletion'
);
select extensions.ok(
  (select p.status = s.row_data ->> 'status'
     and p.amount_minor = (s.row_data ->> 'amount_minor')::bigint
   from public.payments as p cross join lifecycle_snapshots as s
   where p.id = 'd1111111-1111-1111-1111-111111111111' and s.relation_name = 'payment'),
  'payment status and amount survive auth deletion'
);

select extensions.throws_ok(
  $$ update public.order_status_history set note = 'Tampered' where id = '51111111-1111-1111-1111-111111111111' $$,
  '55000', 'order_status_history is append-only', 'order history remains append-only'
);
select extensions.throws_ok(
  $$ update public.inventory_movements set reason = 'Tampered' where id = '52222222-2222-2222-2222-222222222222' $$,
  '55000', 'inventory_movements is append-only', 'inventory movements remain append-only'
);
select extensions.throws_ok(
  $$ update public.payment_events set reason = 'Tampered' where id = '53333333-3333-3333-3333-333333333333' $$,
  '55000', 'payment_events is append-only', 'payment events remain append-only'
);
select extensions.throws_ok(
  $$ update public.audit_logs set action = 'tampered' where id = '54444444-4444-4444-4444-444444444444' $$,
  '55000', 'audit_logs is append-only', 'audit logs remain append-only'
);
select extensions.throws_ok(
  $$ update public.order_status_history set changed_by = '66666666-6666-6666-6666-666666666666' where id = '51111111-1111-1111-1111-111111111111' $$,
  '55000', 'order_status_history is append-only', 'null actor cannot be rewritten to a UUID'
);
select extensions.throws_ok(
  $$ update public.payment_submissions set submitted_by = '66666666-6666-6666-6666-666666666666' where id = '56666666-6666-6666-6666-666666666666' $$,
  '55000', 'payment submission evidence is immutable', 'null submitter cannot be rewritten to a UUID'
);
select extensions.throws_ok(
  $$ update public.payment_submissions set receipt_storage_path = 'tampered.webp' where id = '56666666-6666-6666-6666-666666666666' $$,
  '55000', 'payment submission evidence is immutable', 'payment evidence remains immutable'
);
select extensions.throws_ok(
  $$ delete from public.order_status_history where id = '51111111-1111-1111-1111-111111111111' $$,
  '55000', 'order_status_history is append-only', 'order history cannot be deleted'
);
select extensions.throws_ok(
  $$ delete from public.inventory_movements where id = '52222222-2222-2222-2222-222222222222' $$,
  '55000', 'inventory_movements is append-only', 'inventory movement cannot be deleted'
);
select extensions.throws_ok(
  $$ delete from public.payment_events where id = '53333333-3333-3333-3333-333333333333' $$,
  '55000', 'payment_events is append-only', 'payment event cannot be deleted'
);
select extensions.throws_ok(
  $$ delete from public.audit_logs where id = '54444444-4444-4444-4444-444444444444' $$,
  '55000', 'audit_logs is append-only', 'audit log cannot be deleted'
);
select extensions.throws_ok(
  $$ delete from public.payment_submissions where id = '56666666-6666-6666-6666-666666666666' $$,
  '55000', 'payment submissions cannot be deleted', 'payment submission cannot be deleted'
);

select pg_catalog.set_config('request.jwt.claim.sub', '66666666-6666-6666-6666-666666666666', true);
select pg_catalog.set_config('request.jwt.claims', '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select extensions.throws_ok(
  $$ update public.inventory_movements set actor_id = null where id = '52222222-2222-2222-2222-222222222222' $$,
  '42501', 'permission denied for table inventory_movements', 'customer still cannot update ledger actor fields'
);
reset role;

-- Auth deletion preserves the final super_admin across direct and cascaded role deletes.
insert into auth.users (
  id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  (
    '81111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'delete-customer@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '82222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'delete-admin@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '83333333-3333-3333-3333-333333333333',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'delete-super@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '84444444-4444-4444-4444-444444444444',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'delete-rollback@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into private.user_roles (user_id, role) values
  ('82222222-2222-2222-2222-222222222222', 'admin'),
  ('83333333-3333-3333-3333-333333333333', 'super_admin');

select extensions.lives_ok(
  $$ delete from auth.users where id = '81111111-1111-1111-1111-111111111111' $$,
  'ordinary Auth user deletion succeeds'
);
select extensions.is(
  (select count(*) from public.profiles where id = '81111111-1111-1111-1111-111111111111')
  + (select count(*) from private.user_roles where user_id = '81111111-1111-1111-1111-111111111111'),
  0::bigint, 'ordinary user profile and roles cascade'
);
select extensions.lives_ok(
  $$ delete from auth.users where id = '82222222-2222-2222-2222-222222222222' $$,
  'admin Auth user deletion succeeds'
);
select extensions.is(
  (select count(*) from public.profiles where id = '82222222-2222-2222-2222-222222222222')
  + (select count(*) from private.user_roles where user_id = '82222222-2222-2222-2222-222222222222'),
  0::bigint, 'admin profile and roles cascade'
);
select extensions.lives_ok(
  $$ delete from auth.users where id = '33333333-3333-3333-3333-333333333333' $$,
  'one super_admin may be deleted while another remains'
);
select extensions.is(
  (select count(*) from auth.users where id = '33333333-3333-3333-3333-333333333333')
  + (select count(*) from public.profiles where id = '33333333-3333-3333-3333-333333333333')
  + (select count(*) from private.user_roles where user_id = '33333333-3333-3333-3333-333333333333'),
  0::bigint, 'allowed super_admin deletion completes its cascades'
);
select extensions.ok(
  exists (select 1 from auth.users where id = '83333333-3333-3333-3333-333333333333')
  and exists (select 1 from public.profiles where id = '83333333-3333-3333-3333-333333333333')
  and exists (select 1 from private.user_roles where user_id = '83333333-3333-3333-3333-333333333333' and role = 'super_admin'),
  'the remaining super_admin identity survives'
);
select extensions.throws_ok(
  $$ delete from auth.users where id = '83333333-3333-3333-3333-333333333333' $$,
  '23514', 'LAST_SUPER_ADMIN_REQUIRED', 'sole super_admin Auth deletion is blocked'
);
select extensions.ok(
  exists (select 1 from auth.users where id = '83333333-3333-3333-3333-333333333333'),
  'blocked deletion retains the Auth identity'
);
select extensions.ok(
  exists (select 1 from public.profiles where id = '83333333-3333-3333-3333-333333333333'),
  'blocked deletion retains the profile'
);
select extensions.is(
  (select count(*) from private.user_roles where user_id = '83333333-3333-3333-3333-333333333333'),
  2::bigint, 'blocked deletion retains customer and super_admin roles'
);
select extensions.throws_ok(
  $$ delete from private.user_roles where user_id = '83333333-3333-3333-3333-333333333333' and role = 'super_admin' $$,
  '23514', 'LAST_SUPER_ADMIN_REQUIRED', 'direct role deletion cannot remove the final super_admin'
);
select extensions.throws_ok(
  $$ delete from auth.users where id in ('83333333-3333-3333-3333-333333333333', '84444444-4444-4444-4444-444444444444') $$,
  '23514', 'LAST_SUPER_ADMIN_REQUIRED', 'multi-user deletion cannot include the final super_admin'
);
select extensions.ok(
  exists (select 1 from auth.users where id = '84444444-4444-4444-4444-444444444444')
  and exists (select 1 from public.profiles where id = '84444444-4444-4444-4444-444444444444')
  and exists (select 1 from private.user_roles where user_id = '84444444-4444-4444-4444-444444444444' and role = 'customer'),
  'failed multi-user deletion rolls ordinary-user cascades back'
);

select pg_catalog.set_config('request.jwt.claim.sub', '83333333-3333-3333-3333-333333333333', true);
select pg_catalog.set_config('request.jwt.claims', '{"sub":"83333333-3333-3333-3333-333333333333","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select extensions.throws_ok(
  $$ select public.manage_user_role('83333333-3333-3333-3333-333333333333', 'super_admin', false) $$,
  '23514', 'cannot remove the last super_admin', 'role management still blocks final super_admin removal'
);
reset role;

set local role service_role;
select extensions.throws_ok(
  $$
    select private.transition_payment(
      'd3333333-3333-3333-3333-333333333333', 'FAILED', 'service-bypass',
      '22222222-2222-2222-2222-222222222222'
    )
  $$,
  '42501', null, 'service_role cannot execute the internal payment transition helper'
);
reset role;

select extensions.ok(
  not exists (
    select 1
    from unnest(array[
      'public.profiles', 'private.user_roles', 'public.categories', 'public.products',
      'public.product_variants', 'public.product_options', 'public.product_option_values',
      'public.variant_option_values', 'public.product_images', 'public.inventory',
      'public.inventory_movements', 'public.inventory_reservations', 'public.carts',
      'public.cart_items', 'public.addresses', 'public.orders', 'public.order_items',
      'public.order_status_history', 'public.payments', 'public.payment_submissions',
      'public.payment_events', 'public.audit_logs'
    ]) as app_table(table_name)
    where has_table_privilege('service_role', app_table.table_name, 'INSERT')
       or has_table_privilege('service_role', app_table.table_name, 'UPDATE')
       or has_table_privilege('service_role', app_table.table_name, 'DELETE')
  ),
  'service_role has no direct DML on any application table'
);

select extensions.set_eq(
  $$
    select n.nspname || '.' || p.proname
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and has_function_privilege('service_role', p.oid, 'EXECUTE')
  $$,
    $$ values
    ('public.checkout_order'),
    ('private.reserve_inventory'), ('private.transition_inventory_reservation'),
    ('private.start_gcash_review'),
    ('private.close_expired_gcash_payment')
  $$,
  'service_role can execute only intended atomic commerce routines'
);

select extensions.set_eq(
  $$
    select n.nspname || '.' || p.proname
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
  $$,
  $$ values
    ('private.has_role'), ('public.manage_user_role'),
    ('public.current_user_role'), ('public.list_staff_roles'),
    ('public.submit_gcash_proof'), ('public.approve_gcash_submission'),
    ('public.reject_gcash_submission'), ('public.settle_cod_payment'),
    ('public.admin_transition_order'), ('public.authorize_payment_receipt_preview'),
    ('public.allow_checkout_attempt'), ('public.allow_receipt_upload_attempt')
  $$,
  'authenticated can execute only current-user and narrowly authorized operations'
);

select extensions.ok(
  not exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and p.prorettype = 'pg_catalog.trigger'::pg_catalog.regtype
      and (has_function_privilege('authenticated', p.oid, 'EXECUTE')
           or has_function_privilege('service_role', p.oid, 'EXECUTE'))
  ),
  'application roles cannot directly execute trigger routines'
);

select extensions.ok(
  not exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private') and p.prosecdef
      and (p.proconfig is null or not ('search_path=""' = any(p.proconfig)))
  ),
  'every SECURITY DEFINER routine has an empty fixed search_path'
);

select extensions.ok(
  not has_function_privilege('service_role', 'public.manage_user_role(uuid,text,boolean)', 'EXECUTE'),
  'service_role cannot invoke the auth-derived role operation'
);

select extensions.set_eq(
  $$ select policyname from pg_catalog.pg_policies where schemaname = 'storage' and tablename = 'objects' $$,
  $$ values ('product_images_public_read'), ('payment_receipts_owner_insert') $$,
  'storage objects expose public product reads and owner-bound receipt inserts only'
);

select * from extensions.finish();
rollback;
