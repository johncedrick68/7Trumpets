begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(88);

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

create temp table baseline_state (
  case_name text primary key,
  payment_status text,
  order_status text,
  active_res_count bigint,
  other_res_count bigint,
  on_hand int,
  reserved int,
  movements_count bigint,
  events_count bigint,
  history_count bigint,
  audit_count bigint
);
grant all on baseline_state to public;

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

-- ====================================================================
-- 7. Complete Public RPC Negative Coverage (State-Preservation Invariants)
-- ====================================================================

-- CASE 1: PAID Manual GCash
select public.checkout_order(
  '61000000-0000-0000-0000-000000000001', 'phase11-order-paid',
  '[{"variant_id":"62000000-0000-0000-0000-000000000002","quantity":1}]'::jsonb,
  0, 'MANUAL_GCASH', pg_catalog.now() + interval '1 hour',
  '{"customer_email":"phase11-customer@example.test","recipient_name":"Customer 11","recipient_phone":"09170000000","address_line1":"11 Test St","city_municipality":"City","province":"Province","postal_code":"1000"}'::jsonb,
  null
);
insert into test_ids (key, val) values
  ('payment_paid', (select p.id from public.payments p join public.orders o on o.id=p.order_id where o.idempotency_key='phase11-order-paid')),
  ('order_paid', (select id from public.orders where idempotency_key='phase11-order-paid'));

insert into storage.objects (bucket_id, name, owner_id, metadata)
select 'payment-receipts',
  '61000000-0000-0000-0000-000000000001/' || o.id || '/63000000-0000-0000-0000-000000000002.webp',
  '61000000-0000-0000-0000-000000000001',
  '{"size":100,"mimetype":"image/webp"}'::jsonb
from public.orders o where o.idempotency_key = 'phase11-order-paid';

select pg_catalog.set_config('request.jwt.claim.sub', '61000000-0000-0000-0000-000000000001', true);
select pg_catalog.set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select public.submit_gcash_proof(
  (select val from test_ids where key='payment_paid'),
  15000,
  (select '61000000-0000-0000-0000-000000000001/' || o.id || '/63000000-0000-0000-0000-000000000002.webp' from public.orders o where o.idempotency_key='phase11-order-paid'),
  pg_catalog.now() + interval '2 hours',
  'phase11-sub-paid', 'phase11-event-paid', 'GCASH-REF-PAID'
);
reset role;

insert into test_ids (key, val) values
  ('submission_paid', (select s.id from public.payment_submissions s where s.payment_id = (select val from test_ids where key='payment_paid')));

select pg_catalog.set_config('request.jwt.claim.sub', '61000000-0000-0000-0000-000000000002', true);
select pg_catalog.set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select public.approve_gcash_submission(
  (select val from test_ids where key='payment_paid'),
  (select val from test_ids where key='submission_paid'),
  'phase11-admin-approve-paid',
  'Verified GCash transaction'
);
reset role;

insert into baseline_state values (
  'case_paid',
  (select status from public.payments where id = (select val from test_ids where key='payment_paid')),
  (select status from public.orders where id = (select val from test_ids where key='order_paid')),
  (select count(*) from public.inventory_reservations where order_id = (select val from test_ids where key='order_paid') and status = 'active'),
  (select count(*) from public.inventory_reservations where order_id = (select val from test_ids where key='order_paid') and status <> 'active'),
  (select on_hand from public.inventory where variant_id = '62000000-0000-0000-0000-000000000002'),
  (select reserved from public.inventory where variant_id = '62000000-0000-0000-0000-000000000002'),
  (select count(*) from public.inventory_movements where variant_id = '62000000-0000-0000-0000-000000000002'),
  (select count(*) from public.payment_events where payment_id = (select val from test_ids where key='payment_paid')),
  (select count(*) from public.order_status_history where order_id = (select val from test_ids where key='order_paid')),
  (select count(*) from public.audit_logs where entity = 'payment' and entity_id = (select val from test_ids where key='payment_paid'))
);

set local role authenticated;
select extensions.throws_ok(
  $$ select public.close_expired_gcash_payment((select val from test_ids where key='payment_paid'), 'exp-paid-key', 'Deny PAID') $$,
  'P0001', 'payment requires review or is not timeout-closable from status PAID', 'case_paid: public RPC denied for PAID manual GCash'
);
reset role;

select extensions.is((select status from public.payments where id = (select val from test_ids where key='payment_paid')), (select payment_status from baseline_state where case_name = 'case_paid'), 'case_paid: payment status preserved as PAID');
select extensions.is((select status from public.orders where id = (select val from test_ids where key='order_paid')), (select order_status from baseline_state where case_name = 'case_paid'), 'case_paid: order status preserved');
select extensions.is((select count(*) from public.inventory_reservations where order_id = (select val from test_ids where key='order_paid') and status = 'active'), (select active_res_count from baseline_state where case_name = 'case_paid'), 'case_paid: active reservation count preserved');
select extensions.is((select count(*) from public.inventory_reservations where order_id = (select val from test_ids where key='order_paid') and status <> 'active'), (select other_res_count from baseline_state where case_name = 'case_paid'), 'case_paid: terminal reservation count preserved');
select extensions.is((select on_hand from public.inventory where variant_id = '62000000-0000-0000-0000-000000000002'), (select on_hand from baseline_state where case_name = 'case_paid'), 'case_paid: inventory on_hand preserved');
select extensions.is((select reserved from public.inventory where variant_id = '62000000-0000-0000-0000-000000000002'), (select reserved from baseline_state where case_name = 'case_paid'), 'case_paid: inventory reserved preserved');
select extensions.is((select count(*) from public.inventory_movements where variant_id = '62000000-0000-0000-0000-000000000002'), (select movements_count from baseline_state where case_name = 'case_paid'), 'case_paid: no new inventory movements');
select extensions.is((select count(*) from public.payment_events where payment_id = (select val from test_ids where key='payment_paid')), (select events_count from baseline_state where case_name = 'case_paid'), 'case_paid: no new payment events');
select extensions.is((select count(*) from public.order_status_history where order_id = (select val from test_ids where key='order_paid')), (select history_count from baseline_state where case_name = 'case_paid'), 'case_paid: no new order status history rows');
select extensions.is((select count(*) from public.audit_logs where entity = 'payment' and entity_id = (select val from test_ids where key='payment_paid')), (select audit_count from baseline_state where case_name = 'case_paid'), 'case_paid: no new audit log rows');

-- CASE 2: Manual GCash with pending/unreviewed evidence
select public.checkout_order(
  '61000000-0000-0000-0000-000000000001', 'phase11-order-pending-proof',
  '[{"variant_id":"62000000-0000-0000-0000-000000000002","quantity":1}]'::jsonb,
  0, 'MANUAL_GCASH', pg_catalog.now() + interval '1 hour',
  '{"customer_email":"phase11-customer@example.test","recipient_name":"Customer 11","recipient_phone":"09170000000","address_line1":"11 Test St","city_municipality":"City","province":"Province","postal_code":"1000"}'::jsonb,
  null
);
insert into test_ids (key, val) values
  ('payment_pending', (select p.id from public.payments p join public.orders o on o.id=p.order_id where o.idempotency_key='phase11-order-pending-proof')),
  ('order_pending', (select id from public.orders where idempotency_key='phase11-order-pending-proof'));

insert into storage.objects (bucket_id, name, owner_id, metadata)
select 'payment-receipts',
  '61000000-0000-0000-0000-000000000001/' || o.id || '/63000000-0000-0000-0000-000000000003.webp',
  '61000000-0000-0000-0000-000000000001',
  '{"size":100,"mimetype":"image/webp"}'::jsonb
from public.orders o where o.idempotency_key = 'phase11-order-pending-proof';

select pg_catalog.set_config('request.jwt.claim.sub', '61000000-0000-0000-0000-000000000001', true);
select pg_catalog.set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select public.submit_gcash_proof(
  (select val from test_ids where key='payment_pending'),
  15000,
  (select '61000000-0000-0000-0000-000000000001/' || o.id || '/63000000-0000-0000-0000-000000000003.webp' from public.orders o where o.idempotency_key='phase11-order-pending-proof'),
  pg_catalog.now() + interval '2 hours',
  'phase11-sub-pending', 'phase11-event-pending', 'GCASH-REF-PENDING'
);
reset role;

update public.inventory_reservations
set expires_at = pg_catalog.now() - interval '1 second'
where order_id = (select val from test_ids where key='order_pending');

insert into baseline_state values (
  'case_pending',
  (select status from public.payments where id = (select val from test_ids where key='payment_pending')),
  (select status from public.orders where id = (select val from test_ids where key='order_pending')),
  (select count(*) from public.inventory_reservations where order_id = (select val from test_ids where key='order_pending') and status = 'active'),
  (select count(*) from public.inventory_reservations where order_id = (select val from test_ids where key='order_pending') and status <> 'active'),
  (select on_hand from public.inventory where variant_id = '62000000-0000-0000-0000-000000000002'),
  (select reserved from public.inventory where variant_id = '62000000-0000-0000-0000-000000000002'),
  (select count(*) from public.inventory_movements where variant_id = '62000000-0000-0000-0000-000000000002'),
  (select count(*) from public.payment_events where payment_id = (select val from test_ids where key='payment_pending')),
  (select count(*) from public.order_status_history where order_id = (select val from test_ids where key='order_pending')),
  (select count(*) from public.audit_logs where entity = 'payment' and entity_id = (select val from test_ids where key='payment_pending'))
);

select pg_catalog.set_config('request.jwt.claim.sub', '61000000-0000-0000-0000-000000000002', true);
select pg_catalog.set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select extensions.throws_ok(
  $$ select public.close_expired_gcash_payment((select val from test_ids where key='payment_pending'), 'exp-pending-key', 'Deny pending proof') $$,
  'P0001', 'payment requires review or is not timeout-closable from status SUBMITTED', 'case_pending: public RPC denied for unreviewed pending GCash evidence'
);
reset role;

select extensions.is((select status from public.payments where id = (select val from test_ids where key='payment_pending')), (select payment_status from baseline_state where case_name = 'case_pending'), 'case_pending: payment status preserved as UNPAID');
select extensions.is((select status from public.orders where id = (select val from test_ids where key='order_pending')), (select order_status from baseline_state where case_name = 'case_pending'), 'case_pending: order status preserved');
select extensions.is((select count(*) from public.inventory_reservations where order_id = (select val from test_ids where key='order_pending') and status = 'active'), (select active_res_count from baseline_state where case_name = 'case_pending'), 'case_pending: active reservation count preserved');
select extensions.is((select count(*) from public.inventory_reservations where order_id = (select val from test_ids where key='order_pending') and status <> 'active'), (select other_res_count from baseline_state where case_name = 'case_pending'), 'case_pending: terminal reservation count preserved');
select extensions.is((select on_hand from public.inventory where variant_id = '62000000-0000-0000-0000-000000000002'), (select on_hand from baseline_state where case_name = 'case_pending'), 'case_pending: inventory on_hand preserved');
select extensions.is((select reserved from public.inventory where variant_id = '62000000-0000-0000-0000-000000000002'), (select reserved from baseline_state where case_name = 'case_pending'), 'case_pending: inventory reserved preserved');
select extensions.is((select count(*) from public.inventory_movements where variant_id = '62000000-0000-0000-0000-000000000002'), (select movements_count from baseline_state where case_name = 'case_pending'), 'case_pending: no new inventory movements');
select extensions.is((select count(*) from public.payment_events where payment_id = (select val from test_ids where key='payment_pending')), (select events_count from baseline_state where case_name = 'case_pending'), 'case_pending: no new payment events');
select extensions.is((select count(*) from public.order_status_history where order_id = (select val from test_ids where key='order_pending')), (select history_count from baseline_state where case_name = 'case_pending'), 'case_pending: no new order status history rows');
select extensions.is((select count(*) from public.audit_logs where entity = 'payment' and entity_id = (select val from test_ids where key='payment_pending')), (select audit_count from baseline_state where case_name = 'case_pending'), 'case_pending: no new audit log rows');

-- CASE 3: Finalized/completed order state
select public.checkout_order(
  '61000000-0000-0000-0000-000000000001', 'phase11-order-completed',
  '[{"variant_id":"62000000-0000-0000-0000-000000000002","quantity":1}]'::jsonb,
  0, 'MANUAL_GCASH', pg_catalog.now() + interval '1 hour',
  '{"customer_email":"phase11-customer@example.test","recipient_name":"Customer 11","recipient_phone":"09170000000","address_line1":"11 Test St","city_municipality":"City","province":"Province","postal_code":"1000"}'::jsonb,
  null
);
insert into test_ids (key, val) values
  ('payment_completed', (select p.id from public.payments p join public.orders o on o.id=p.order_id where o.idempotency_key='phase11-order-completed')),
  ('order_completed', (select id from public.orders where idempotency_key='phase11-order-completed'));

-- Set order status to COMPLETED (finalized state)
set local session_replication_role = replica;
update public.orders set status = 'COMPLETED' where id = (select val from test_ids where key='order_completed');
set local session_replication_role = origin;

insert into baseline_state values (
  'case_completed',
  (select status from public.payments where id = (select val from test_ids where key='payment_completed')),
  (select status from public.orders where id = (select val from test_ids where key='order_completed')),
  (select count(*) from public.inventory_reservations where order_id = (select val from test_ids where key='order_completed') and status = 'active'),
  (select count(*) from public.inventory_reservations where order_id = (select val from test_ids where key='order_completed') and status <> 'active'),
  (select on_hand from public.inventory where variant_id = '62000000-0000-0000-0000-000000000002'),
  (select reserved from public.inventory where variant_id = '62000000-0000-0000-0000-000000000002'),
  (select count(*) from public.inventory_movements where variant_id = '62000000-0000-0000-0000-000000000002'),
  (select count(*) from public.payment_events where payment_id = (select val from test_ids where key='payment_completed')),
  (select count(*) from public.order_status_history where order_id = (select val from test_ids where key='order_completed')),
  (select count(*) from public.audit_logs where entity = 'payment' and entity_id = (select val from test_ids where key='payment_completed'))
);

set local role authenticated;
select extensions.throws_ok(
  $$ select public.close_expired_gcash_payment((select val from test_ids where key='payment_completed'), 'exp-completed-key', 'Deny completed order') $$,
  'P0001', 'payment requires review or is not timeout-closable from status UNPAID', 'case_completed: public RPC denied for finalized/completed order state'
);
reset role;

select extensions.is((select status from public.payments where id = (select val from test_ids where key='payment_completed')), (select payment_status from baseline_state where case_name = 'case_completed'), 'case_completed: payment status preserved');
select extensions.is((select status from public.orders where id = (select val from test_ids where key='order_completed')), (select order_status from baseline_state where case_name = 'case_completed'), 'case_completed: order status preserved as COMPLETED');
select extensions.is((select count(*) from public.inventory_reservations where order_id = (select val from test_ids where key='order_completed') and status = 'active'), (select active_res_count from baseline_state where case_name = 'case_completed'), 'case_completed: active reservation count preserved');
select extensions.is((select count(*) from public.inventory_reservations where order_id = (select val from test_ids where key='order_completed') and status <> 'active'), (select other_res_count from baseline_state where case_name = 'case_completed'), 'case_completed: terminal reservation count preserved');
select extensions.is((select on_hand from public.inventory where variant_id = '62000000-0000-0000-0000-000000000002'), (select on_hand from baseline_state where case_name = 'case_completed'), 'case_completed: inventory on_hand preserved');
select extensions.is((select reserved from public.inventory where variant_id = '62000000-0000-0000-0000-000000000002'), (select reserved from baseline_state where case_name = 'case_completed'), 'case_completed: inventory reserved preserved');
select extensions.is((select count(*) from public.inventory_movements where variant_id = '62000000-0000-0000-0000-000000000002'), (select movements_count from baseline_state where case_name = 'case_completed'), 'case_completed: no new inventory movements');
select extensions.is((select count(*) from public.payment_events where payment_id = (select val from test_ids where key='payment_completed')), (select events_count from baseline_state where case_name = 'case_completed'), 'case_completed: no new payment events');
select extensions.is((select count(*) from public.order_status_history where order_id = (select val from test_ids where key='order_completed')), (select history_count from baseline_state where case_name = 'case_completed'), 'case_completed: no new order status history rows');
select extensions.is((select count(*) from public.audit_logs where entity = 'payment' and entity_id = (select val from test_ids where key='payment_completed')), (select audit_count from baseline_state where case_name = 'case_completed'), 'case_completed: no new audit log rows');

-- CASE 4: Already cancelled order
insert into baseline_state values (
  'case_cancelled',
  (select status from public.payments where id = (select val from test_ids where key='payment_unpaid')),
  (select status from public.orders where id = (select val from test_ids where key='order_unpaid')),
  (select count(*) from public.inventory_reservations where order_id = (select val from test_ids where key='order_unpaid') and status = 'active'),
  (select count(*) from public.inventory_reservations where order_id = (select val from test_ids where key='order_unpaid') and status <> 'active'),
  (select on_hand from public.inventory where variant_id = '62000000-0000-0000-0000-000000000002'),
  (select reserved from public.inventory where variant_id = '62000000-0000-0000-0000-000000000002'),
  (select count(*) from public.inventory_movements where variant_id = '62000000-0000-0000-0000-000000000002'),
  (select count(*) from public.payment_events where payment_id = (select val from test_ids where key='payment_unpaid')),
  (select count(*) from public.order_status_history where order_id = (select val from test_ids where key='order_unpaid')),
  (select count(*) from public.audit_logs where entity = 'payment' and entity_id = (select val from test_ids where key='payment_unpaid'))
);

set local role authenticated;
select extensions.throws_ok(
  $$ select public.close_expired_gcash_payment((select val from test_ids where key='payment_unpaid'), 'exp-cancelled-fresh-key', 'Deny already cancelled') $$,
  'P0001', 'payment requires review or is not timeout-closable from status FAILED', 'case_cancelled: public RPC denied for already cancelled order'
);
reset role;

select extensions.is((select status from public.payments where id = (select val from test_ids where key='payment_unpaid')), (select payment_status from baseline_state where case_name = 'case_cancelled'), 'case_cancelled: payment status preserved as FAILED');
select extensions.is((select status from public.orders where id = (select val from test_ids where key='order_unpaid')), (select order_status from baseline_state where case_name = 'case_cancelled'), 'case_cancelled: order status preserved as CANCELLED');
select extensions.is((select count(*) from public.inventory_reservations where order_id = (select val from test_ids where key='order_unpaid') and status = 'active'), (select active_res_count from baseline_state where case_name = 'case_cancelled'), 'case_cancelled: active reservation count preserved (0)');
select extensions.is((select count(*) from public.inventory_reservations where order_id = (select val from test_ids where key='order_unpaid') and status <> 'active'), (select other_res_count from baseline_state where case_name = 'case_cancelled'), 'case_cancelled: terminal reservation count preserved (1 expired)');
select extensions.is((select on_hand from public.inventory where variant_id = '62000000-0000-0000-0000-000000000002'), (select on_hand from baseline_state where case_name = 'case_cancelled'), 'case_cancelled: inventory on_hand preserved');
select extensions.is((select reserved from public.inventory where variant_id = '62000000-0000-0000-0000-000000000002'), (select reserved from baseline_state where case_name = 'case_cancelled'), 'case_cancelled: inventory reserved preserved');
select extensions.is((select count(*) from public.inventory_movements where variant_id = '62000000-0000-0000-0000-000000000002'), (select movements_count from baseline_state where case_name = 'case_cancelled'), 'case_cancelled: no new inventory movements');
select extensions.is((select count(*) from public.payment_events where payment_id = (select val from test_ids where key='payment_unpaid')), (select events_count from baseline_state where case_name = 'case_cancelled'), 'case_cancelled: no new payment events');
select extensions.is((select count(*) from public.order_status_history where order_id = (select val from test_ids where key='order_unpaid')), (select history_count from baseline_state where case_name = 'case_cancelled'), 'case_cancelled: no new order status history rows');
select extensions.is((select count(*) from public.audit_logs where entity = 'payment' and entity_id = (select val from test_ids where key='payment_unpaid')), (select audit_count from baseline_state where case_name = 'case_cancelled'), 'case_cancelled: no new audit log rows');

-- CASE 5: Order/payment state with no reservations
insert into public.orders (
  user_id, idempotency_key, status, currency_code,
  subtotal_minor, discount_minor, shipping_minor, total_minor,
  customer_email, recipient_name, recipient_phone, address_line1,
  city_municipality, province, postal_code
) values (
  '61000000-0000-0000-0000-000000000001',
  'phase11-order-no-res', 'CONFIRMED', 'PHP',
  15000, 0, 0, 15000,
  'phase11-customer@example.test', 'Customer 11', '09170000000', '11 Test St',
  'City', 'Province', '1000'
);
insert into test_ids (key, val) values
  ('order_no_res', (select id from public.orders where idempotency_key='phase11-order-no-res'));

insert into public.payments (
  order_id, method, status, amount_minor, currency_code, idempotency_key
) values (
  (select val from test_ids where key='order_no_res'), 'MANUAL_GCASH', 'UNPAID', 15000, 'PHP', 'phase11-pay-no-res'
);
insert into test_ids (key, val) values
  ('payment_no_res', (select id from public.payments where order_id=(select val from test_ids where key='order_no_res')));

insert into baseline_state values (
  'case_no_res',
  (select status from public.payments where id = (select val from test_ids where key='payment_no_res')),
  (select status from public.orders where id = (select val from test_ids where key='order_no_res')),
  (select count(*) from public.inventory_reservations where order_id = (select val from test_ids where key='order_no_res') and status = 'active'),
  (select count(*) from public.inventory_reservations where order_id = (select val from test_ids where key='order_no_res') and status <> 'active'),
  (select on_hand from public.inventory where variant_id = '62000000-0000-0000-0000-000000000002'),
  (select reserved from public.inventory where variant_id = '62000000-0000-0000-0000-000000000002'),
  (select count(*) from public.inventory_movements where variant_id = '62000000-0000-0000-0000-000000000002'),
  (select count(*) from public.payment_events where payment_id = (select val from test_ids where key='payment_no_res')),
  (select count(*) from public.order_status_history where order_id = (select val from test_ids where key='order_no_res')),
  (select count(*) from public.audit_logs where entity = 'payment' and entity_id = (select val from test_ids where key='payment_no_res'))
);

set local role authenticated;
select extensions.throws_ok(
  $$ select public.close_expired_gcash_payment((select val from test_ids where key='payment_no_res'), 'exp-no-res-key', 'Deny no reservations') $$,
  'P0001', 'payment order has no reservations', 'case_no_res: public RPC denied for order with no reservations'
);
reset role;

select extensions.is((select status from public.payments where id = (select val from test_ids where key='payment_no_res')), (select payment_status from baseline_state where case_name = 'case_no_res'), 'case_no_res: payment status preserved as UNPAID');
select extensions.is((select status from public.orders where id = (select val from test_ids where key='order_no_res')), (select order_status from baseline_state where case_name = 'case_no_res'), 'case_no_res: order status preserved as CONFIRMED');
select extensions.is((select count(*) from public.inventory_reservations where order_id = (select val from test_ids where key='order_no_res') and status = 'active'), (select active_res_count from baseline_state where case_name = 'case_no_res'), 'case_no_res: active reservation count preserved (0)');
select extensions.is((select count(*) from public.inventory_reservations where order_id = (select val from test_ids where key='order_no_res') and status <> 'active'), (select other_res_count from baseline_state where case_name = 'case_no_res'), 'case_no_res: terminal reservation count preserved (0)');
select extensions.is((select on_hand from public.inventory where variant_id = '62000000-0000-0000-0000-000000000002'), (select on_hand from baseline_state where case_name = 'case_no_res'), 'case_no_res: inventory on_hand preserved');
select extensions.is((select reserved from public.inventory where variant_id = '62000000-0000-0000-0000-000000000002'), (select reserved from baseline_state where case_name = 'case_no_res'), 'case_no_res: inventory reserved preserved');
select extensions.is((select count(*) from public.inventory_movements where variant_id = '62000000-0000-0000-0000-000000000002'), (select movements_count from baseline_state where case_name = 'case_no_res'), 'case_no_res: no new inventory movements');
select extensions.is((select count(*) from public.payment_events where payment_id = (select val from test_ids where key='payment_no_res')), (select events_count from baseline_state where case_name = 'case_no_res'), 'case_no_res: no new payment events');
select extensions.is((select count(*) from public.order_status_history where order_id = (select val from test_ids where key='order_no_res')), (select history_count from baseline_state where case_name = 'case_no_res'), 'case_no_res: no new order status history rows');
select extensions.is((select count(*) from public.audit_logs where entity = 'payment' and entity_id = (select val from test_ids where key='payment_no_res')), (select audit_count from baseline_state where case_name = 'case_no_res'), 'case_no_res: no new audit log rows');

select * from extensions.finish();
rollback;
