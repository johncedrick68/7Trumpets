begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(17);

insert into public.orders (
  id, idempotency_key, status, subtotal_minor, total_minor, customer_email,
  recipient_name, recipient_phone, address_line1, city_municipality, province,
  postal_code, sales_channel, fulfillment_method
) values
  ('56000000-0000-0000-0000-000000000001', 'guard-cod', 'CONFIRMED', 10000, 10000, 'guard@example.test', 'Guard', '1', 'Street', 'City', 'Province', '1000', 'STOREFRONT', 'SHIPMENT'),
  ('56000000-0000-0000-0000-000000000002', 'guard-gcash', 'CONFIRMED', 10000, 10000, 'guard@example.test', 'Guard', '1', 'Street', 'City', 'Province', '1000', 'STOREFRONT', 'SHIPMENT'),
  ('56000000-0000-0000-0000-000000000003', 'guard-pickup', 'CONFIRMED', 10000, 10000, 'guard@example.test', 'Guard', '1', 'Street', 'City', 'Province', '1000', 'STOREFRONT', 'STORE_PICKUP'),
  ('56000000-0000-0000-0000-000000000004', 'guard-pos', 'CONFIRMED', 10000, 10000, 'guard@example.test', 'Guard', '1', 'Street', 'City', 'Province', '1000', 'POS', 'STORE_PICKUP'),
  ('56000000-0000-0000-0000-000000000005', 'guard-no-payment', 'CONFIRMED', 10000, 10000, 'guard@example.test', 'Guard', '1', 'Street', 'City', 'Province', '1000', 'STOREFRONT', 'SHIPMENT');

insert into public.payments (
  id, order_id, method, status, amount_minor, idempotency_key, paid_at
) values
  ('57000000-0000-0000-0000-000000000001', '56000000-0000-0000-0000-000000000001', 'COD', 'UNPAID', 10000, 'guard-pay-cod', null),
  ('57000000-0000-0000-0000-000000000002', '56000000-0000-0000-0000-000000000002', 'MANUAL_GCASH', 'UNPAID', 10000, 'guard-pay-gcash', null),
  ('57000000-0000-0000-0000-000000000003', '56000000-0000-0000-0000-000000000003', 'CASH', 'UNPAID', 10000, 'guard-pay-pickup', null),
  ('57000000-0000-0000-0000-000000000004', '56000000-0000-0000-0000-000000000004', 'CASH', 'UNPAID', 10000, 'guard-pay-pos', null);

set local session_replication_role = replica;
update public.orders set status = 'DELIVERED'
where id in (
  '56000000-0000-0000-0000-000000000001',
  '56000000-0000-0000-0000-000000000002',
  '56000000-0000-0000-0000-000000000004',
  '56000000-0000-0000-0000-000000000005'
);
update public.orders set status = 'PROCESSING'
where id = '56000000-0000-0000-0000-000000000003';
update public.payments set status = 'PAID', paid_at = now()
where id = '57000000-0000-0000-0000-000000000004';
set local session_replication_role = origin;

select extensions.throws_ok(
  $$ update public.orders set status = 'COMPLETED' where id = '56000000-0000-0000-0000-000000000001' $$,
  '23514', 'completed order requires paid payment',
  'direct COD completion rejects an unpaid payment'
);
select extensions.is(
  (select status from public.orders where id = '56000000-0000-0000-0000-000000000001'),
  'DELIVERED', 'rejected COD completion leaves the order delivered'
);

set local session_replication_role = replica;
update public.payments set status = 'PAID', paid_at = now()
where id = '57000000-0000-0000-0000-000000000001';
set local session_replication_role = origin;
update public.orders set status = 'COMPLETED'
where id = '56000000-0000-0000-0000-000000000001';
select extensions.is(
  (select status from public.orders where id = '56000000-0000-0000-0000-000000000001'),
  'COMPLETED', 'paid COD order completes'
);

select extensions.throws_ok(
  $$ select public.transition_order('56000000-0000-0000-0000-000000000002', 'COMPLETED', null, 'guard-test', null, 'guard-gcash-unpaid') $$,
  '23514', 'completed order requires paid payment',
  'canonical GCash completion rejects an unpaid payment'
);
select extensions.is(
  (select status from public.orders where id = '56000000-0000-0000-0000-000000000002'),
  'DELIVERED', 'rejected GCash completion leaves the order delivered'
);
select extensions.is(
  (select count(*) from public.order_status_history where idempotency_key = 'guard-gcash-unpaid'),
  0::bigint, 'rejected canonical completion creates no history row'
);

set local session_replication_role = replica;
update public.payments set status = 'PAID', paid_at = now()
where id = '57000000-0000-0000-0000-000000000002';
set local session_replication_role = origin;
select extensions.is(
  (public.transition_order('56000000-0000-0000-0000-000000000002', 'COMPLETED', null, 'guard-test', null, 'guard-gcash-paid')).status,
  'COMPLETED', 'paid GCash order completes through the canonical boundary'
);

update public.orders set status = 'DELIVERED'
where id = '56000000-0000-0000-0000-000000000003';
select extensions.is(
  (select status from public.orders where id = '56000000-0000-0000-0000-000000000003'),
  'DELIVERED', 'store-pickup PROCESSING to DELIVERED path remains allowed'
);
select extensions.throws_ok(
  $$ update public.orders set status = 'COMPLETED' where id = '56000000-0000-0000-0000-000000000003' $$,
  '23514', 'completed order requires paid payment',
  'unpaid store-pickup order cannot complete'
);
select extensions.is(
  (select status from public.orders where id = '56000000-0000-0000-0000-000000000003'),
  'DELIVERED', 'rejected pickup completion leaves the order delivered'
);

set local session_replication_role = replica;
update public.payments set status = 'PAID', paid_at = now()
where id = '57000000-0000-0000-0000-000000000003';
set local session_replication_role = origin;
update public.orders set status = 'COMPLETED'
where id = '56000000-0000-0000-0000-000000000003';
select extensions.is(
  (select status from public.orders where id = '56000000-0000-0000-0000-000000000003'),
  'COMPLETED', 'paid store-pickup order completes'
);

update public.orders set status = 'COMPLETED'
where id = '56000000-0000-0000-0000-000000000004';
select extensions.is(
  (select status from public.orders where id = '56000000-0000-0000-0000-000000000004'),
  'COMPLETED', 'paid POS order completion remains allowed'
);
select extensions.is(
  (select sales_channel from public.orders where id = '56000000-0000-0000-0000-000000000004'),
  'POS', 'POS sales channel remains unchanged'
);

select extensions.throws_ok(
  $$ update public.orders set status = 'PROCESSING' where id = '56000000-0000-0000-0000-000000000004' $$,
  '23514', 'invalid order transition: COMPLETED -> PROCESSING',
  'terminal completed order cannot return to processing'
);
select extensions.is(
  (select status from public.orders where id = '56000000-0000-0000-0000-000000000004'),
  'COMPLETED', 'rejected terminal transition preserves completed state'
);

select extensions.throws_ok(
  $$ update public.orders set status = 'COMPLETED' where id = '56000000-0000-0000-0000-000000000005' $$,
  '23514', 'completed order requires paid payment',
  'order without a payment cannot complete'
);
select extensions.is(
  (select status from public.orders where id = '56000000-0000-0000-0000-000000000005'),
  'DELIVERED', 'missing-payment rejection preserves delivered state'
);

select * from extensions.finish();
rollback;
