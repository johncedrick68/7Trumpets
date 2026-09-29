begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();
insert into auth.users(id,instance_id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('71000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','checkout-security@example.test','{}','{}',now(),now());
insert into public.products(id,slug,name,status) values ('71000000-0000-0000-0000-000000000002','checkout-security','Checkout security','published');
insert into public.product_variants(id,product_id,sku,price_minor,status) values ('71000000-0000-0000-0000-000000000003','71000000-0000-0000-0000-000000000002','CHECKOUT-SECURITY',10000,'active');
insert into public.inventory(variant_id,on_hand) values ('71000000-0000-0000-0000-000000000003',50);
update public.store_settings set value = value || '{"cod_enabled":true,"gcash_enabled":true,"cod_max_minor":10500}'::jsonb where key='payment';

-- Invoker-only test helpers; all fixtures disappear at final rollback.
create function pg_temp.checkout_call(k text, shipping bigint, method text default 'COD', fulfillment text default 'SHIPMENT') returns uuid language sql as $$
select (public.checkout_order('71000000-0000-0000-0000-000000000001'::uuid,k,
'[{"variant_id":"71000000-0000-0000-0000-000000000003","quantity":1}]'::jsonb,
shipping,method,case when method='MANUAL_GCASH' then '2100-01-01'::timestamptz else null end,
'{"customer_email":"checkout-security@example.test","recipient_name":"QA","recipient_phone":"1","address_line1":"Street","city_municipality":"City","province":"Province","postal_code":"1000"}'::jsonb,fulfillment,null::text)).id;
$$;
create function pg_temp.legacy_call() returns uuid language sql as $$
select (public.checkout_order(p_customer_id=>null::uuid,p_idempotency_key=>'denied',p_lines=>'[]'::jsonb,p_shipping_minor=>0::bigint,p_payment_method=>'COD',p_gcash_expires_at=>null::timestamptz,p_delivery=>'{}'::jsonb,p_customer_note=>null::text)).id;
$$;

grant execute on function pg_temp.checkout_call(text,bigint,text,text) to anon, authenticated, service_role;
grant execute on function pg_temp.legacy_call() to anon, authenticated, service_role;

select extensions.ok(not has_function_privilege('anon','public.checkout_order(uuid,text,jsonb,bigint,text,timestamptz,jsonb,text)','EXECUTE'),'anon legacy denied');
select extensions.ok(not has_function_privilege('anon','public.checkout_order(uuid,text,jsonb,bigint,text,timestamptz,jsonb,text,text)','EXECUTE'),'anon fulfillment denied');
select extensions.ok(not has_function_privilege('authenticated','public.checkout_order(uuid,text,jsonb,bigint,text,timestamptz,jsonb,text)','EXECUTE'),'authenticated legacy denied');
select extensions.ok(not has_function_privilege('authenticated','public.checkout_order(uuid,text,jsonb,bigint,text,timestamptz,jsonb,text,text)','EXECUTE'),'authenticated fulfillment denied');
select extensions.ok(not exists(select 1 from pg_proc p, lateral aclexplode(p.proacl) a where p.oid in ('public.checkout_order(uuid,text,jsonb,bigint,text,timestamptz,jsonb,text)'::regprocedure,'public.checkout_order(uuid,text,jsonb,bigint,text,timestamptz,jsonb,text,text)'::regprocedure) and a.grantee=0 and a.privilege_type='EXECUTE'),'no PUBLIC execution');
set local role anon;
select extensions.throws_ok($$select pg_temp.legacy_call()$$,'42501',null,'anon direct legacy rejected');
select extensions.throws_ok($$select pg_temp.checkout_call('anon-denied',0)$$,'42501',null,'anon direct fulfillment rejected');
reset role;
set local role authenticated;
select extensions.throws_ok($$select pg_temp.legacy_call()$$,'42501',null,'authenticated legacy rejected');
select extensions.throws_ok($$select pg_temp.checkout_call('spoof-customer',0)$$,'42501',null,'other customer identity rejected before business logic');
select extensions.throws_ok($$select pg_temp.checkout_call('negative-shipping',-1)$$,'42501',null,'negative shipping cannot bypass backend');
select extensions.throws_ok($$select pg_temp.checkout_call('reduced-shipping',1)$$,'42501',null,'reduced shipping cannot bypass backend');
reset role;
set local role service_role;
select extensions.lives_ok($$select pg_temp.checkout_call('security-below',499)$$,'trusted backend COD below ceiling');
select extensions.lives_ok($$select pg_temp.checkout_call('security-exact',500)$$,'COD exact ceiling');
select extensions.throws_ok($$select pg_temp.checkout_call('security-retry',501)$$,'22023','COD_LIMIT_EXCEEDED','one centavo above including shipping rejected');
select extensions.is((select count(*) from public.orders where idempotency_key='security-retry'),0::bigint,'no rejected order persists');
select extensions.is((select count(*) from public.payments where idempotency_key='checkout-payment:' || md5('security-retry')),0::bigint,'no rejected payment persists');
select extensions.is((select reserved from public.inventory where variant_id='71000000-0000-0000-0000-000000000003'),0,'rejected checkout leaves reserved stock unchanged after COD consumption');
select extensions.is((select on_hand from public.inventory where variant_id='71000000-0000-0000-0000-000000000003'),48,'rejected checkout leaves on-hand stock unchanged after two valid COD orders');
select extensions.lives_ok($$select pg_temp.checkout_call('security-retry',500)$$,'corrected attempt succeeds');
select extensions.is(pg_temp.checkout_call('security-retry',500),pg_temp.checkout_call('security-retry',500),'valid retry returns same order');
select extensions.lives_ok($$select pg_temp.checkout_call('security-gcash',501,'MANUAL_GCASH')$$,'GCash above COD ceiling unaffected');
select extensions.lives_ok($$select pg_temp.checkout_call('security-pickup',0,'CASH','STORE_PICKUP')$$,'cash pickup unaffected');
reset role;
update public.store_settings set value=value || '{"cod_max_minor":"bad"}'::jsonb where key='payment';
set local role service_role;
select extensions.throws_ok($$select pg_temp.checkout_call('security-malformed',0)$$,'22023','CHECKOUT_CONFIGURATION_UNAVAILABLE','malformed ceiling fails closed');
reset role;
delete from public.store_settings where key='payment';
set local role service_role;
select extensions.throws_ok($$select pg_temp.checkout_call('security-missing',0)$$,'22023','CHECKOUT_CONFIGURATION_UNAVAILABLE','missing configuration fails closed');
reset role;
select * from extensions.finish();
rollback;
