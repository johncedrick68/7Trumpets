begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(42);

insert into auth.users (
  id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  ('51000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase3b-customer@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('51000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase3b-admin@example.test', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into private.user_roles (user_id, role)
values ('51000000-0000-0000-0000-000000000002', 'admin');

select pg_catalog.set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000002', true);
select pg_catalog.set_config('request.jwt.claims', '{"sub":"51000000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;

select extensions.is(public.current_user_role(), 'admin', 'current-user role lookup returns only the caller effective role');
select extensions.throws_ok($$ select * from public.list_staff_roles() $$, '42501', 'super_admin AAL2 required', 'AAL1 staff cannot list roles');
select extensions.throws_ok($$ select public.approve_gcash_submission(gen_random_uuid(), gen_random_uuid(), 'aal1-approve') $$, '42501', 'admin AAL2 required', 'AAL1 payment approval is denied');
select extensions.throws_ok($$ select public.reject_gcash_submission(gen_random_uuid(), gen_random_uuid(), 'reason', 'aal1-reject') $$, '42501', 'admin AAL2 required', 'AAL1 payment rejection is denied');
select extensions.throws_ok($$ select public.settle_cod_payment(gen_random_uuid(), 'reason', 'aal1-cod') $$, '42501', 'admin AAL2 required', 'AAL1 COD settlement is denied');
select extensions.throws_ok($$ select public.admin_transition_order(gen_random_uuid(), 'PROCESSING', null, 'test', 'aal1-order') $$, '42501', 'admin AAL2 required', 'AAL1 order transition is denied');
select extensions.throws_ok($$ select public.authorize_payment_receipt_preview(gen_random_uuid()) $$, '42501', 'admin AAL2 required', 'AAL1 receipt preview is denied');
reset role;

select pg_catalog.set_config('request.jwt.claims', '{"sub":"51000000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select extensions.throws_ok($$ select public.approve_gcash_submission(gen_random_uuid(), gen_random_uuid(), 'aal2-approve') $$, 'P0002', 'payment not found', 'AAL2 admin passes wrapper authorization');
reset role;

select pg_catalog.set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000001', true);
select pg_catalog.set_config('request.jwt.claims', '{"sub":"51000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select extensions.is(public.current_user_role(), 'customer', 'customer role lookup cannot obtain staff role');
select extensions.throws_ok($$ select public.approve_gcash_submission(gen_random_uuid(), gen_random_uuid(), 'customer-approve') $$, '42501', 'admin AAL2 required', 'AAL2 customer cannot approve payment');
select extensions.throws_ok($$ select public.authorize_payment_receipt_preview(gen_random_uuid()) $$, '42501', 'admin AAL2 required', 'AAL2 customer cannot preview staff receipts');

select extensions.ok(public.allow_checkout_attempt('phase3b-checkout-1'), 'checkout attempt one is allowed');
select extensions.ok(public.allow_checkout_attempt('phase3b-checkout-2'), 'checkout attempt two is allowed');
select extensions.ok(public.allow_checkout_attempt('phase3b-checkout-3'), 'checkout attempt three is allowed');
select extensions.ok(public.allow_checkout_attempt('phase3b-checkout-4'), 'checkout attempt four is allowed');
select extensions.ok(public.allow_checkout_attempt('phase3b-checkout-5'), 'checkout attempt five is allowed');
select extensions.ok(not public.allow_checkout_attempt('phase3b-checkout-6'), 'checkout attempt six is throttled');
reset role;
select extensions.is((select attempt_count from private.commerce_throttles where actor_id = auth.uid() and action = 'checkout_order'), 6::bigint, 'denied checkout attempts remain counted');

insert into public.products (id, slug, name, status)
values ('52000000-0000-0000-0000-000000000001', 'phase3b-product', 'Phase 3B Product', 'published');
insert into public.product_variants (id, product_id, sku, price_minor)
values ('52000000-0000-0000-0000-000000000002', '52000000-0000-0000-0000-000000000001', 'PHASE3B', 10000);
insert into public.inventory (variant_id, on_hand) values ('52000000-0000-0000-0000-000000000002', 20);

select public.checkout_order(
  '51000000-0000-0000-0000-000000000001', 'phase3b-gcash',
  '[{"variant_id":"52000000-0000-0000-0000-000000000002","quantity":1}]'::jsonb,
  0, 'MANUAL_GCASH', '2100-01-01 00:00:00+00'::timestamptz,
  '{"customer_email":"phase3b-customer@example.test","recipient_name":"Customer","recipient_phone":"1","address_line1":"Street","city_municipality":"City","province":"Province","postal_code":"1000"}'::jsonb,
  null
);
insert into storage.objects (bucket_id, name, owner_id, metadata)
select 'payment-receipts',
  '51000000-0000-0000-0000-000000000001/' || o.id || '/53000000-0000-0000-0000-000000000001.webp',
  '51000000-0000-0000-0000-000000000001',
  '{"size":100,"mimetype":"image/webp"}'::jsonb
from public.orders o where o.idempotency_key = 'phase3b-gcash';

select pg_catalog.set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000001', true);
select pg_catalog.set_config('request.jwt.claims', '{"sub":"51000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select extensions.ok(public.allow_receipt_upload_attempt((select p.id from public.payments p join public.orders o on o.id=p.order_id where o.idempotency_key='phase3b-gcash')), 'receipt attempt one is allowed');
select extensions.ok(public.allow_receipt_upload_attempt((select p.id from public.payments p join public.orders o on o.id=p.order_id where o.idempotency_key='phase3b-gcash')), 'receipt attempt two is allowed');
select extensions.ok(public.allow_receipt_upload_attempt((select p.id from public.payments p join public.orders o on o.id=p.order_id where o.idempotency_key='phase3b-gcash')), 'receipt attempt three is allowed');
select extensions.ok(public.allow_receipt_upload_attempt((select p.id from public.payments p join public.orders o on o.id=p.order_id where o.idempotency_key='phase3b-gcash')), 'receipt attempt four is allowed');
select extensions.ok(public.allow_receipt_upload_attempt((select p.id from public.payments p join public.orders o on o.id=p.order_id where o.idempotency_key='phase3b-gcash')), 'receipt attempt five is allowed');
select extensions.ok(not public.allow_receipt_upload_attempt((select p.id from public.payments p join public.orders o on o.id=p.order_id where o.idempotency_key='phase3b-gcash')), 'receipt attempt six is throttled');
reset role;
select extensions.is((select attempt_count from private.commerce_throttles where actor_id=auth.uid() and action='receipt_upload'), 6::bigint, 'denied receipt attempts remain counted');
set local role authenticated;
select extensions.ok(public.submit_gcash_proof(
  (select p.id from public.payments p join public.orders o on o.id=p.order_id where o.idempotency_key='phase3b-gcash'),
  10000,
  (select '51000000-0000-0000-0000-000000000001/' || o.id || '/53000000-0000-0000-0000-000000000001.webp' from public.orders o where o.idempotency_key='phase3b-gcash'),
  '2100-01-02 00:00:00+00'::timestamptz,
  'phase3b-public-proof', 'phase3b-public-event', 'PHASE3B-REF'
) is not null, 'authenticated owner submits proof through public boundary');
reset role;

select public.checkout_order(
  '51000000-0000-0000-0000-000000000001', 'phase3b-cod-delivered',
  '[{"variant_id":"52000000-0000-0000-0000-000000000002","quantity":1}]'::jsonb,
  0, 'COD', null,
  '{"customer_email":"phase3b-customer@example.test","recipient_name":"Customer","recipient_phone":"1","address_line1":"Street","city_municipality":"City","province":"Province","postal_code":"1000"}'::jsonb,
  null
);

set local session_replication_role = replica;
update public.orders set status = 'CONFIRMED' where idempotency_key = 'phase3b-cod-delivered';
set local session_replication_role = origin;
select extensions.throws_ok($$ select private.settle_cod_payment((select p.id from public.payments p join public.orders o on o.id=p.order_id where o.idempotency_key='phase3b-cod-delivered'),'51000000-0000-0000-0000-000000000002','cash','cod-confirmed') $$, 'P0001', 'COD settlement requires delivered order', 'CONFIRMED COD settlement denied');
set local session_replication_role = replica; update public.orders set status = 'PROCESSING' where idempotency_key = 'phase3b-cod-delivered'; set local session_replication_role = origin;
select extensions.throws_ok($$ select private.settle_cod_payment((select p.id from public.payments p join public.orders o on o.id=p.order_id where o.idempotency_key='phase3b-cod-delivered'),'51000000-0000-0000-0000-000000000002','cash','cod-processing') $$, 'P0001', 'COD settlement requires delivered order', 'PROCESSING COD settlement denied');
set local session_replication_role = replica; update public.orders set status = 'PACKING' where idempotency_key = 'phase3b-cod-delivered'; set local session_replication_role = origin;
select extensions.throws_ok($$ select private.settle_cod_payment((select p.id from public.payments p join public.orders o on o.id=p.order_id where o.idempotency_key='phase3b-cod-delivered'),'51000000-0000-0000-0000-000000000002','cash','cod-packing') $$, 'P0001', 'COD settlement requires delivered order', 'PACKING COD settlement denied');
set local session_replication_role = replica; update public.orders set status = 'READY_FOR_SHIPMENT' where idempotency_key = 'phase3b-cod-delivered'; set local session_replication_role = origin;
select extensions.throws_ok($$ select private.settle_cod_payment((select p.id from public.payments p join public.orders o on o.id=p.order_id where o.idempotency_key='phase3b-cod-delivered'),'51000000-0000-0000-0000-000000000002','cash','cod-ready') $$, 'P0001', 'COD settlement requires delivered order', 'READY_FOR_SHIPMENT COD settlement denied');
set local session_replication_role = replica; update public.orders set status = 'SHIPPED' where idempotency_key = 'phase3b-cod-delivered'; set local session_replication_role = origin;
select extensions.throws_ok($$ select private.settle_cod_payment((select p.id from public.payments p join public.orders o on o.id=p.order_id where o.idempotency_key='phase3b-cod-delivered'),'51000000-0000-0000-0000-000000000002','cash','cod-shipped') $$, 'P0001', 'COD settlement requires delivered order', 'SHIPPED COD settlement denied');
set local session_replication_role = replica; update public.orders set status = 'IN_TRANSIT' where idempotency_key = 'phase3b-cod-delivered'; set local session_replication_role = origin;
select extensions.throws_ok($$ select private.settle_cod_payment((select p.id from public.payments p join public.orders o on o.id=p.order_id where o.idempotency_key='phase3b-cod-delivered'),'51000000-0000-0000-0000-000000000002','cash','cod-transit') $$, 'P0001', 'COD settlement requires delivered order', 'IN_TRANSIT COD settlement denied');
set local session_replication_role = replica; update public.orders set status = 'OUT_FOR_DELIVERY' where idempotency_key = 'phase3b-cod-delivered'; set local session_replication_role = origin;
select extensions.throws_ok($$ select private.settle_cod_payment((select p.id from public.payments p join public.orders o on o.id=p.order_id where o.idempotency_key='phase3b-cod-delivered'),'51000000-0000-0000-0000-000000000002','cash','cod-out') $$, 'P0001', 'COD settlement requires delivered order', 'OUT_FOR_DELIVERY COD settlement denied');
set local session_replication_role = replica; update public.orders set status = 'CANCELLED', cancellation_reason = 'test cancellation' where idempotency_key = 'phase3b-cod-delivered'; set local session_replication_role = origin;
select extensions.throws_ok($$ select private.settle_cod_payment((select p.id from public.payments p join public.orders o on o.id=p.order_id where o.idempotency_key='phase3b-cod-delivered'),'51000000-0000-0000-0000-000000000002','cash','cod-cancelled') $$, 'P0001', 'COD settlement requires delivered order', 'CANCELLED COD settlement denied');
set local session_replication_role = replica; update public.orders set status = 'DELIVERY_FAILED', delivery_failure_reason = 'test failure' where idempotency_key = 'phase3b-cod-delivered'; set local session_replication_role = origin;
select extensions.throws_ok($$ select private.settle_cod_payment((select p.id from public.payments p join public.orders o on o.id=p.order_id where o.idempotency_key='phase3b-cod-delivered'),'51000000-0000-0000-0000-000000000002','cash','cod-failed') $$, 'P0001', 'COD settlement requires delivered order', 'DELIVERY_FAILED COD settlement denied');
set local session_replication_role = replica; update public.orders set status = 'DELIVERED' where idempotency_key = 'phase3b-cod-delivered'; set local session_replication_role = origin;
select extensions.throws_ok($$ select public.transition_order((select id from public.orders where idempotency_key='phase3b-cod-delivered'),'COMPLETED',null,'test',null,'unpaid-complete') $$, '23514', 'completed order requires paid payment', 'unpaid delivered order cannot complete');
select extensions.is(private.settle_cod_payment((select p.id from public.payments p join public.orders o on o.id=p.order_id where o.idempotency_key='phase3b-cod-delivered'),'51000000-0000-0000-0000-000000000002','cash','cod-delivered'),'PAID','DELIVERED COD settlement allowed');
select extensions.is((public.transition_order((select id from public.orders where idempotency_key='phase3b-cod-delivered'),'COMPLETED',null,'test',null,'paid-complete')).status,'COMPLETED','paid delivered COD order completes');

select public.checkout_order(
  '51000000-0000-0000-0000-000000000001', 'phase3b-cod-recovery',
  '[{"variant_id":"52000000-0000-0000-0000-000000000002","quantity":1}]'::jsonb,
  0, 'COD', null,
  '{"customer_email":"phase3b-customer@example.test","recipient_name":"Customer","recipient_phone":"1","address_line1":"Street","city_municipality":"City","province":"Province","postal_code":"1000"}'::jsonb,
  null
);
set local session_replication_role = replica; update public.orders set status = 'COMPLETED' where idempotency_key = 'phase3b-cod-recovery'; set local session_replication_role = origin;
select extensions.is(private.settle_cod_payment((select p.id from public.payments p join public.orders o on o.id=p.order_id where o.idempotency_key='phase3b-cod-recovery'),'51000000-0000-0000-0000-000000000002','recovery cash','cod-recovery'),'PAID','COMPLETED settlement is allowed only as legacy recovery');

select extensions.ok(
  not has_table_privilege('authenticated', 'private.user_roles', 'SELECT')
  and not has_table_privilege('authenticated', 'private.commerce_throttles', 'SELECT'),
  'authenticated users cannot read private tables'
);
select extensions.ok(not has_function_privilege('service_role', 'private.submit_gcash_proof(uuid,uuid,bigint,text,text,timestamptz,text,text)', 'EXECUTE'), 'service role no longer calls private proof RPC directly');
select extensions.ok(has_function_privilege('authenticated', 'public.submit_gcash_proof(uuid,bigint,text,timestamptz,text,text,text)', 'EXECUTE'), 'authenticated user can call public proof boundary');

select * from extensions.finish();
rollback;
