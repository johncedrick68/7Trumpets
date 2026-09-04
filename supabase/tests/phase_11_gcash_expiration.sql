begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(33);

-- 1. Identity & Role Setup
insert into auth.users (
  id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  ('61000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase11-customer@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('61000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase11-admin@example.test', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into private.user_roles (user_id, role)
values ('61000000-0000-0000-0000-000000000002', 'admin');

-- 2. Authorization Negative Tests
-- Anonymous caller
set local role anon;
select extensions.throws_ok(
  $$ select public.close_expired_gcash_payment(gen_random_uuid(), 'anon-exp', 'reason') $$,
  '42501', 'permission denied for function close_expired_gcash_payment', 'anonymous caller cannot close expired gcash payment'
);
select extensions.throws_ok(
  $$ select * from public.list_expired_gcash_payments() $$,
  '42501', 'permission denied for function list_expired_gcash_payments', 'anonymous caller cannot list expired gcash payments'
);
reset role;

-- Customer caller (even with AAL2)
select pg_catalog.set_config('request.jwt.claim.sub', '61000000-0000-0000-0000-000000000001', true);
select pg_catalog.set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select extensions.throws_ok(
  $$ select public.close_expired_gcash_payment(gen_random_uuid(), 'cust-exp', 'reason') $$,
  '42501', 'admin AAL2 required', 'customer AAL2 cannot close expired gcash payment'
);
select extensions.throws_ok(
  $$ select * from public.list_expired_gcash_payments() $$,
  '42501', 'admin AAL2 required', 'customer AAL2 cannot list expired gcash payments'
);
reset role;

-- Admin caller with only AAL1
select pg_catalog.set_config('request.jwt.claim.sub', '61000000-0000-0000-0000-000000000002', true);
select pg_catalog.set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select extensions.throws_ok(
  $$ select public.close_expired_gcash_payment(gen_random_uuid(), 'aal1-exp', 'reason') $$,
  '42501', 'admin AAL2 required', 'admin AAL1 cannot close expired gcash payment'
);
select extensions.throws_ok(
  $$ select * from public.list_expired_gcash_payments() $$,
  '42501', 'admin AAL2 required', 'admin AAL1 cannot list expired gcash payments'
);
reset role;

-- 3. Catalog & Inventory Setup
insert into public.products (id, slug, name, status)
values ('62000000-0000-0000-0000-000000000001', 'phase11-product', 'Phase 11 Product', 'published');

insert into public.product_variants (id, product_id, sku, price_minor)
values ('62000000-0000-0000-0000-000000000002', '62000000-0000-0000-0000-000000000001', 'PHASE11-SKU', 15000);

insert into public.inventory (variant_id, on_hand, reserved, safety_stock)
values ('62000000-0000-0000-0000-000000000002', 10, 0, 0);

-- 4. Order 1: Unpaid Manual GCash (no proof submitted)
select public.checkout_order(
  '61000000-0000-0000-0000-000000000001', 'phase11-order-unpaid',
  '[{"variant_id":"62000000-0000-0000-0000-000000000002","quantity":2}]'::jsonb,
  0, 'MANUAL_GCASH', pg_catalog.now() + interval '1 hour',
  '{"customer_email":"phase11-customer@example.test","recipient_name":"Customer 11","recipient_phone":"09170000000","address_line1":"11 Test St","city_municipality":"City","province":"Province","postal_code":"1000"}'::jsonb,
  null
);

-- Store IDs in session temp table to bypass outer RLS during tests
create temp table test_ids (
  key text primary key,
  val uuid not null
);
grant all on test_ids to public;

insert into test_ids (key, val) values
  ('payment_unpaid', (select p.id from public.payments p join public.orders o on o.id=p.order_id where o.idempotency_key='phase11-order-unpaid')),
  ('order_unpaid', (select id from public.orders where idempotency_key='phase11-order-unpaid'));

-- Set admin AAL2 context
select pg_catalog.set_config('request.jwt.claim.sub', '61000000-0000-0000-0000-000000000002', true);
select pg_catalog.set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;

-- Non-expired denial test
select extensions.throws_ok(
  $$ select public.close_expired_gcash_payment((select val from test_ids where key='payment_unpaid'), 'phase11-exp-early', 'Too early') $$,
  'P0001', 'payment retry window has not expired', 'unexpired gcash reservation cannot be closed'
);

-- list_expired_gcash_payments does NOT show unexpired orders
select extensions.is(
  (select count(*) from public.list_expired_gcash_payments() where payment_id = (select val from test_ids where key='payment_unpaid')),
  0::bigint, 'unexpired gcash order is not listed in eligibility query'
);
reset role;

-- Empty reason validation test
set local role authenticated;
select extensions.throws_ok(
  $$ select public.close_expired_gcash_payment((select val from test_ids where key='payment_unpaid'), 'phase11-exp-empty-reason', '   ') $$,
  '22023', 'invalid GCash timeout closure input', 'empty reason is rejected'
);
reset role;

-- Fast-forward expiration for Order 1
update public.inventory_reservations
set expires_at = pg_catalog.now() - interval '5 seconds'
where order_id = (select val from test_ids where key='order_unpaid');

-- Check list_expired_gcash_payments lists it now
set local role authenticated;
select extensions.is(
  (select count(*) from public.list_expired_gcash_payments() where payment_id = (select val from test_ids where key='payment_unpaid')),
  1::bigint, 'expired unpaid gcash order is now listed in eligibility query'
);

-- Execute valid expiration via public RPC
select extensions.is(
  public.close_expired_gcash_payment(
    (select val from test_ids where key='payment_unpaid'),
    'gcash_expire_phase11_unpaid', 'Payment deadline expired without proof'
  ),
  'FAILED', 'expired unpaid gcash payment closes and returns FAILED'
);
reset role;

-- Verify order cancelled and cancellation reason set
select extensions.is(
  (select status from public.orders where id = (select val from test_ids where key='order_unpaid')),
  'CANCELLED', 'order status transitioned to CANCELLED'
);
select extensions.is(
  (select cancellation_reason from public.orders where id = (select val from test_ids where key='order_unpaid')),
  'Payment deadline expired without proof', 'order cancellation reason recorded'
);

-- Verify payment status FAILED
select extensions.is(
  (select status from public.payments where id = (select val from test_ids where key='payment_unpaid')),
  'FAILED', 'payment status transitioned to FAILED'
);

-- Verify reservations expired
select extensions.is(
  (select count(*) from public.inventory_reservations where order_id = (select val from test_ids where key='order_unpaid') and status = 'expired'),
  1::bigint, 'all reservations transitioned to expired'
);
select extensions.is(
  (select count(*) from public.inventory_reservations where order_id = (select val from test_ids where key='order_unpaid') and status = 'active'),
  0::bigint, 'no active reservations remain'
);

-- Verify available inventory restored exactly once
select extensions.is(
  (select reserved from public.inventory where variant_id='62000000-0000-0000-0000-000000000002'),
  0, 'inventory reserved balance restored to 0'
);
select extensions.is(
  (select on_hand from public.inventory where variant_id='62000000-0000-0000-0000-000000000002'),
  10, 'inventory on_hand remains intact'
);

-- Verify inventory_movements ledger
select extensions.is(
  (select movement_type from public.inventory_movements where reservation_id = (select id from public.inventory_reservations where order_id = (select val from test_ids where key='order_unpaid')) and movement_type = 'reservation_expired'),
  'reservation_expired', 'inventory movement recorded as reservation_expired'
);
select extensions.is(
  (select reserved_delta from public.inventory_movements where reservation_id = (select id from public.inventory_reservations where order_id = (select val from test_ids where key='order_unpaid')) and movement_type = 'reservation_expired'),
  -2, 'inventory movement recorded -2 reserved delta'
);

-- Verify order_status_history
select extensions.ok(
  exists (
    select 1 from public.order_status_history h
    where h.order_id = (select val from test_ids where key='order_unpaid')
      and h.from_status = 'CONFIRMED' and h.to_status = 'CANCELLED'
      and h.source = 'gcash_timeout' and h.changed_by = '61000000-0000-0000-0000-000000000002'
  ),
  'order_status_history recorded gcash_timeout transition'
);

-- Verify audit_logs
select extensions.ok(
  exists (
    select 1 from public.audit_logs a
    where a.entity = 'payment' and a.action = 'payment.timeout_closed'
      and a.actor_id = '61000000-0000-0000-0000-000000000002'
  ),
  'audit_logs recorded payment.timeout_closed'
);

-- Verify list_expired_gcash_payments no longer lists the resolved order
set local role authenticated;
select extensions.is(
  (select count(*) from public.list_expired_gcash_payments() where payment_id = (select val from test_ids where key='payment_unpaid')),
  0::bigint, 'resolved order is no longer in eligibility query'
);

-- Idempotency Test: Repeating call with same stable idempotency key succeeds as safe replay
select extensions.is(
  public.close_expired_gcash_payment(
    (select val from test_ids where key='payment_unpaid'),
    'gcash_expire_phase11_unpaid', 'Payment deadline expired without proof'
  ),
  'FAILED', 'exact idempotency key replay returns previous status safely'
);
reset role;

select extensions.is(
  (select reserved from public.inventory where variant_id='62000000-0000-0000-0000-000000000002'),
  0, 'idempotent replay does not duplicate inventory restoration'
);
select extensions.is(
  (select count(*) from public.inventory_movements where reservation_id = (select id from public.inventory_reservations where order_id = (select val from test_ids where key='order_unpaid'))),
  2::bigint, 'idempotent replay does not create duplicate inventory movement'
);

-- Conflicting idempotency key on already-cancelled order is denied
set local role authenticated;
select extensions.throws_ok(
  $$ select public.close_expired_gcash_payment((select val from test_ids where key='payment_unpaid'), 'gcash_expire_different_key', 'Another reason') $$,
  'P0001', 'payment requires review or is not timeout-closable from status FAILED', 'conflicting retry on finalized order is safely denied'
);
reset role;

-- 5. Order 2: Rejected Submission Expiration
select public.checkout_order(
  '61000000-0000-0000-0000-000000000001', 'phase11-order-rejected',
  '[{"variant_id":"62000000-0000-0000-0000-000000000002","quantity":1}]'::jsonb,
  0, 'MANUAL_GCASH', pg_catalog.now() + interval '1 hour',
  '{"customer_email":"phase11-customer@example.test","recipient_name":"Customer 11","recipient_phone":"09170000000","address_line1":"11 Test St","city_municipality":"City","province":"Province","postal_code":"1000"}'::jsonb,
  null
);

insert into test_ids (key, val) values
  ('payment_rejected', (select p.id from public.payments p join public.orders o on o.id=p.order_id where o.idempotency_key='phase11-order-rejected')),
  ('order_rejected', (select id from public.orders where idempotency_key='phase11-order-rejected'));

-- Insert fake storage receipt and submit proof
insert into storage.objects (bucket_id, name, owner_id, metadata)
select 'payment-receipts',
  '61000000-0000-0000-0000-000000000001/' || o.id || '/63000000-0000-0000-0000-000000000001.webp',
  '61000000-0000-0000-0000-000000000001',
  '{"size":100,"mimetype":"image/webp"}'::jsonb
from public.orders o where o.idempotency_key = 'phase11-order-rejected';

select pg_catalog.set_config('request.jwt.claim.sub', '61000000-0000-0000-0000-000000000001', true);
select pg_catalog.set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;

select public.submit_gcash_proof(
  (select val from test_ids where key='payment_rejected'),
  15000,
  (select '61000000-0000-0000-0000-000000000001/' || o.id || '/63000000-0000-0000-0000-000000000001.webp' from public.orders o where o.idempotency_key='phase11-order-rejected'),
  pg_catalog.now() + interval '2 hours',
  'phase11-sub-rej', 'phase11-event-rej', 'GCASH-REF-11'
);
reset role;

insert into test_ids (key, val) values
  ('submission_rejected', (select s.id from public.payment_submissions s where s.payment_id = (select val from test_ids where key='payment_rejected')));

-- Admin rejects submission before deadline (v_final_resolution = false, customer can resubmit while active)
select pg_catalog.set_config('request.jwt.claim.sub', '61000000-0000-0000-0000-000000000002', true);
select pg_catalog.set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;

select public.reject_gcash_submission(
  (select val from test_ids where key='payment_rejected'),
  (select val from test_ids where key='submission_rejected'),
  'Unclear receipt image', 'phase11-admin-reject-initial'
);
reset role;

-- Verify payment is REJECTED, order still CONFIRMED, reservation still active
select extensions.is(
  (select status from public.payments where id = (select val from test_ids where key='payment_rejected')),
  'REJECTED', 'payment status is REJECTED awaiting resubmission'
);
select extensions.is(
  (select status from public.orders where id = (select val from test_ids where key='order_rejected')),
  'CONFIRMED', 'order remains CONFIRMED during retry window'
);

-- Fast forward expiration for Order 2
update public.inventory_reservations
set expires_at = pg_catalog.now() - interval '1 second'
where order_id = (select val from test_ids where key='order_rejected');

-- Expire rejected GCash order after deadline
set local role authenticated;
select extensions.is(
  public.close_expired_gcash_payment(
    (select val from test_ids where key='payment_rejected'),
    'gcash_expire_phase11_rejected', 'Window expired after rejected evidence'
  ),
  'REJECTED', 'expired rejected payment closes window and returns REJECTED'
);
reset role;

select extensions.is(
  (select status from public.orders where id = (select val from test_ids where key='order_rejected')),
  'CANCELLED', 'rejected order cancelled after window closure'
);
select extensions.ok(
  exists (
    select 1 from public.payment_events e
    where e.payment_id = (select val from test_ids where key='payment_rejected')
      and e.event_type = 'PAYMENT_WINDOW_CLOSED'
  ),
  'PAYMENT_WINDOW_CLOSED event recorded'
);

-- 6. Other Negative Denials
-- COD denial
select public.checkout_order(
  '61000000-0000-0000-0000-000000000001', 'phase11-cod-order',
  '[{"variant_id":"62000000-0000-0000-0000-000000000002","quantity":1}]'::jsonb,
  0, 'COD', null,
  '{"customer_email":"phase11-customer@example.test","recipient_name":"Customer 11","recipient_phone":"09170000000","address_line1":"11 Test St","city_municipality":"City","province":"Province","postal_code":"1000"}'::jsonb,
  null
);
insert into test_ids (key, val) values
  ('payment_cod', (select p.id from public.payments p join public.orders o on o.id=p.order_id where o.idempotency_key='phase11-cod-order'));

set local role authenticated;
select extensions.throws_ok(
  $$ select public.close_expired_gcash_payment((select val from test_ids where key='payment_cod'), 'exp-cod', 'Attempt COD close') $$,
  'P0001', 'payment requires review or is not timeout-closable from status UNPAID', 'COD order closure is denied'
);
reset role;

select * from extensions.finish();
rollback;
