begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(62);

create function pg_temp.public_can_execute(p_function regprocedure)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from pg_catalog.pg_proc p
    cross join lateral pg_catalog.aclexplode(
      coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
    ) acl
    where p.oid = p_function
      and acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  );
$$;

select extensions.ok(not pg_temp.public_can_execute('public.admin_save_category(uuid,text,text,text,uuid,integer,boolean)'), 'PUBLIC cannot execute admin_save_category');
select extensions.ok(not pg_catalog.has_function_privilege('anon', 'public.admin_save_category(uuid,text,text,text,uuid,integer,boolean)', 'EXECUTE'), 'anon cannot execute admin_save_category');
select extensions.ok(pg_catalog.has_function_privilege('authenticated', 'public.admin_save_category(uuid,text,text,text,uuid,integer,boolean)', 'EXECUTE'), 'authenticated can execute admin_save_category');
select extensions.ok(not pg_catalog.has_function_privilege('service_role', 'public.admin_save_category(uuid,text,text,text,uuid,integer,boolean)', 'EXECUTE'), 'service_role cannot execute admin_save_category');

select extensions.ok(not pg_temp.public_can_execute('public.admin_save_product(uuid,uuid,text,text,text,text)'), 'PUBLIC cannot execute admin_save_product');
select extensions.ok(not pg_catalog.has_function_privilege('anon', 'public.admin_save_product(uuid,uuid,text,text,text,text)', 'EXECUTE'), 'anon cannot execute admin_save_product');
select extensions.ok(pg_catalog.has_function_privilege('authenticated', 'public.admin_save_product(uuid,uuid,text,text,text,text)', 'EXECUTE'), 'authenticated can execute admin_save_product');
select extensions.ok(not pg_catalog.has_function_privilege('service_role', 'public.admin_save_product(uuid,uuid,text,text,text,text)', 'EXECUTE'), 'service_role cannot execute admin_save_product');

select extensions.ok(not pg_temp.public_can_execute('public.admin_save_variant(uuid,uuid,text,text,bigint,bigint,text)'), 'PUBLIC cannot execute admin_save_variant');
select extensions.ok(not pg_catalog.has_function_privilege('anon', 'public.admin_save_variant(uuid,uuid,text,text,bigint,bigint,text)', 'EXECUTE'), 'anon cannot execute admin_save_variant');
select extensions.ok(pg_catalog.has_function_privilege('authenticated', 'public.admin_save_variant(uuid,uuid,text,text,bigint,bigint,text)', 'EXECUTE'), 'authenticated can execute admin_save_variant');
select extensions.ok(not pg_catalog.has_function_privilege('service_role', 'public.admin_save_variant(uuid,uuid,text,text,bigint,bigint,text)', 'EXECUTE'), 'service_role cannot execute admin_save_variant');

select extensions.ok(not pg_temp.public_can_execute('public.admin_adjust_inventory(uuid,integer,text,text,text)'), 'PUBLIC cannot execute admin_adjust_inventory');
select extensions.ok(not pg_catalog.has_function_privilege('anon', 'public.admin_adjust_inventory(uuid,integer,text,text,text)', 'EXECUTE'), 'anon cannot execute admin_adjust_inventory');
select extensions.ok(pg_catalog.has_function_privilege('authenticated', 'public.admin_adjust_inventory(uuid,integer,text,text,text)', 'EXECUTE'), 'authenticated can execute admin_adjust_inventory');
select extensions.ok(not pg_catalog.has_function_privilege('service_role', 'public.admin_adjust_inventory(uuid,integer,text,text,text)', 'EXECUTE'), 'service_role cannot execute admin_adjust_inventory');

select extensions.ok(not pg_temp.public_can_execute('public.admin_save_product_option(uuid,text,uuid,integer)'), 'PUBLIC cannot execute admin_save_product_option');
select extensions.ok(not pg_catalog.has_function_privilege('anon', 'public.admin_save_product_option(uuid,text,uuid,integer)', 'EXECUTE'), 'anon cannot execute admin_save_product_option');
select extensions.ok(pg_catalog.has_function_privilege('authenticated', 'public.admin_save_product_option(uuid,text,uuid,integer)', 'EXECUTE'), 'authenticated can execute admin_save_product_option');
select extensions.ok(not pg_catalog.has_function_privilege('service_role', 'public.admin_save_product_option(uuid,text,uuid,integer)', 'EXECUTE'), 'service_role cannot execute admin_save_product_option');

select extensions.ok(not pg_temp.public_can_execute('public.admin_save_option_value(uuid,uuid,text,uuid,integer)'), 'PUBLIC cannot execute admin_save_option_value');
select extensions.ok(not pg_catalog.has_function_privilege('anon', 'public.admin_save_option_value(uuid,uuid,text,uuid,integer)', 'EXECUTE'), 'anon cannot execute admin_save_option_value');
select extensions.ok(pg_catalog.has_function_privilege('authenticated', 'public.admin_save_option_value(uuid,uuid,text,uuid,integer)', 'EXECUTE'), 'authenticated can execute admin_save_option_value');
select extensions.ok(not pg_catalog.has_function_privilege('service_role', 'public.admin_save_option_value(uuid,uuid,text,uuid,integer)', 'EXECUTE'), 'service_role cannot execute admin_save_option_value');

select extensions.ok(not pg_temp.public_can_execute('public.admin_set_variant_option_value(uuid,uuid,uuid,uuid)'), 'PUBLIC cannot execute admin_set_variant_option_value');
select extensions.ok(not pg_catalog.has_function_privilege('anon', 'public.admin_set_variant_option_value(uuid,uuid,uuid,uuid)', 'EXECUTE'), 'anon cannot execute admin_set_variant_option_value');
select extensions.ok(pg_catalog.has_function_privilege('authenticated', 'public.admin_set_variant_option_value(uuid,uuid,uuid,uuid)', 'EXECUTE'), 'authenticated can execute admin_set_variant_option_value');
select extensions.ok(not pg_catalog.has_function_privilege('service_role', 'public.admin_set_variant_option_value(uuid,uuid,uuid,uuid)', 'EXECUTE'), 'service_role cannot execute admin_set_variant_option_value');

select extensions.ok(not pg_temp.public_can_execute('public.admin_save_product_image(uuid,text,text,uuid,integer)'), 'PUBLIC cannot execute admin_save_product_image');
select extensions.ok(not pg_catalog.has_function_privilege('anon', 'public.admin_save_product_image(uuid,text,text,uuid,integer)', 'EXECUTE'), 'anon cannot execute admin_save_product_image');
select extensions.ok(pg_catalog.has_function_privilege('authenticated', 'public.admin_save_product_image(uuid,text,text,uuid,integer)', 'EXECUTE'), 'authenticated can execute admin_save_product_image');
select extensions.ok(not pg_catalog.has_function_privilege('service_role', 'public.admin_save_product_image(uuid,text,text,uuid,integer)', 'EXECUTE'), 'service_role cannot execute admin_save_product_image');

select extensions.ok(not pg_temp.public_can_execute('public.admin_delete_product_image(uuid)'), 'PUBLIC cannot execute admin_delete_product_image');
select extensions.ok(not pg_catalog.has_function_privilege('anon', 'public.admin_delete_product_image(uuid)', 'EXECUTE'), 'anon cannot execute admin_delete_product_image');
select extensions.ok(pg_catalog.has_function_privilege('authenticated', 'public.admin_delete_product_image(uuid)', 'EXECUTE'), 'authenticated can execute admin_delete_product_image');
select extensions.ok(not pg_catalog.has_function_privilege('service_role', 'public.admin_delete_product_image(uuid)', 'EXECUTE'), 'service_role cannot execute admin_delete_product_image');

select extensions.ok(
  not exists (
    select 1
    from pg_catalog.pg_default_acl d
    join pg_catalog.pg_namespace n on n.oid = d.defaclnamespace
    cross join lateral pg_catalog.aclexplode(d.defaclacl) acl
    left join pg_catalog.pg_roles grantee on grantee.oid = acl.grantee
    where d.defaclrole = 'postgres'::regrole
      and n.nspname = 'public'
      and d.defaclobjtype = 'f'
      and acl.privilege_type = 'EXECUTE'
      and (acl.grantee = 0 or grantee.rolname in ('anon', 'authenticated', 'service_role'))
  ),
  'postgres public-function defaults grant no execute to PUBLIC, anon, authenticated, or service_role'
);

-- 1. Setup test users
insert into auth.users (
  id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('61000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase4-customer@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('61000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase4-admin@example.test', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into private.user_roles (user_id, role)
values ('61000000-0000-0000-0000-000000000002', 'admin');

-- 2. Test Customer Denial
select pg_catalog.set_config('request.jwt.claim.sub', '61000000-0000-0000-0000-000000000001', true);
select pg_catalog.set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;

select extensions.throws_ok($$ select public.admin_save_category(p_name => 'Test', p_slug => 'test') $$, '42501', 'admin role required', 'Customer cannot save category');
select extensions.throws_ok($$ select public.admin_save_product(p_name => 'Test', p_slug => 'test') $$, '42501', 'admin role required', 'Customer cannot save product');
select extensions.throws_ok($$ select public.admin_save_variant(p_product_id => gen_random_uuid(), p_sku => 'TEST', p_price_minor => 1000) $$, '42501', 'admin role required', 'Customer cannot save variant');
select extensions.throws_ok($$ select public.admin_adjust_inventory(gen_random_uuid(), 5, 'adjustment', 'test', 'idem-1') $$, '42501', 'admin role required', 'Customer cannot adjust inventory');

reset role;

-- 3. Test Admin AAL1 Denial
select pg_catalog.set_config('request.jwt.claim.sub', '61000000-0000-0000-0000-000000000002', true);
select pg_catalog.set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;

select extensions.throws_ok($$ select public.admin_save_category(p_name => 'Test', p_slug => 'test') $$, '42501', 'AAL2 required for admin mutations', 'AAL1 admin cannot save category');
select extensions.throws_ok($$ select public.admin_save_product(p_name => 'Test', p_slug => 'test') $$, '42501', 'AAL2 required for admin mutations', 'AAL1 admin cannot save product');
select extensions.throws_ok($$ select public.admin_adjust_inventory(gen_random_uuid(), 5, 'adjustment', 'test', 'idem-2') $$, '42501', 'AAL2 required for admin mutations', 'AAL1 admin cannot adjust inventory');

reset role;

-- 4. Test Admin AAL2 Success & Invariants
select pg_catalog.set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;

-- 4.1 Categories
select extensions.throws_ok($$ select public.admin_save_category(p_name => '', p_slug => 'test') $$, '22023', 'category name is required', 'Empty category name is rejected');
select extensions.throws_ok($$ select public.admin_save_category(p_name => 'Valid', p_slug => 'INVALID SLUG!') $$, '22023', 'invalid category slug', 'Invalid category slug is rejected');

select public.admin_save_category(p_name => 'Devotional Books', p_slug => 'devotional-books') as cat_id \gset
select extensions.ok(
  exists (select 1 from public.categories where id = :'cat_id'::uuid),
  'Admin AAL2 successfully creates category'
);

-- 4.2 Products
select extensions.throws_ok($$ select public.admin_save_product(p_name => 'Product', p_slug => 'prod', p_category_id => gen_random_uuid()) $$, 'P0002', 'category not found', 'Invalid category ID is rejected');
select extensions.throws_ok($$ select public.admin_save_product(p_name => 'Product', p_slug => 'prod', p_status => 'invalid_status') $$, '22023', 'invalid product status', 'Invalid product status is rejected');

select public.admin_save_product(p_category_id => :'cat_id'::uuid, p_name => 'Trumpet Prayer Journal', p_slug => 'trumpet-prayer-journal', p_status => 'published') as prod_id \gset
select extensions.ok(
  exists (select 1 from public.products where id = :'prod_id'::uuid and status = 'published'),
  'Admin AAL2 successfully creates published product'
);

-- 4.3 Variants & Automated Inventory Creation
select extensions.throws_ok(format('select public.admin_save_variant(p_product_id => %L::uuid, p_sku => ''JOURNAL-1'', p_price_minor => -100)', :'prod_id'), '22023', 'price_minor must be non-negative integer', 'Negative price is rejected');

select public.admin_save_variant(p_product_id => :'prod_id'::uuid, p_sku => 'JOURNAL-GOLD', p_name => 'Gold Edition', p_price_minor => 49900) as var_id \gset
select extensions.ok(
  exists (select 1 from public.product_variants where id = :'var_id'::uuid and price_minor = 49900),
  'Admin AAL2 creates variant with integer minor-unit price'
);

reset role;
select extensions.is((select on_hand from public.inventory where variant_id = :'var_id'::uuid), 0, 'Inventory entry initialized to 0 on variant creation');

-- 4.4 Inventory Adjustments & Idempotency
set local role authenticated;

select extensions.is(
  (public.admin_adjust_inventory(:'var_id'::uuid, 25, 'restock', 'Initial batch restock', 'inv-idem-batch-1') ->> 'on_hand')::int,
  25,
  'Admin restock increases on_hand inventory to 25'
);

select extensions.is(
  (public.admin_adjust_inventory(:'var_id'::uuid, -5, 'adjustment', 'Damaged items write-off', 'inv-idem-batch-2') ->> 'on_hand')::int,
  20,
  'Admin negative adjustment decreases on_hand to 20'
);

select extensions.throws_ok(
  format('select public.admin_adjust_inventory(%L::uuid, -50, ''adjustment'', ''Excessive deduction'', ''inv-idem-fail'')', :'var_id'),
  '23514',
  'adjustment would cause negative on_hand inventory',
  'Negative adjustment beyond on_hand balance is prevented'
);

select extensions.is(
  (public.admin_adjust_inventory(:'var_id'::uuid, 25, 'restock', 'Initial batch restock', 'inv-idem-batch-1') ->> 'idempotent_replay')::boolean,
  true,
  'Idempotent replay returns existing balance without creating double adjustments'
);

reset role;

select extensions.is(
  (select count(*) from public.inventory_movements where variant_id = :'var_id'::uuid),
  2::bigint,
  'Exactly two inventory movement records exist for the two distinct operations'
);

select extensions.is(
  (select count(*) from public.audit_logs where entity = 'inventory_movement'),
  2::bigint,
  'Audit log rows accurately record stock adjustments'
);

-- 4.5 Product Options & Combinations
set local role authenticated;

select public.admin_save_product_option(:'prod_id'::uuid, 'Cover Material') as opt_id \gset
select public.admin_save_product_image(:'prod_id'::uuid, 'phase-4/journal.webp', 'Gold prayer journal', :'var_id'::uuid, 2) as image_id \gset
select extensions.ok(
  exists (select 1 from public.product_options where id = :'opt_id'::uuid)
  and exists (
    select 1 from public.product_images
    where id = :'image_id'::uuid and product_id = :'prod_id'::uuid and variant_id = :'var_id'::uuid
      and storage_path = 'phase-4/journal.webp' and alt_text = 'Gold prayer journal' and position = 2
  ),
  'Admin creates a product option and correctly linked image metadata'
);

select public.admin_save_option_value(:'prod_id'::uuid, :'opt_id'::uuid, 'Leatherette') as opt_val_id \gset
select extensions.ok(
  exists (select 1 from public.product_option_values where id = :'opt_val_id'::uuid),
  'Admin creates option value'
);

select extensions.is(
  public.admin_set_variant_option_value(:'prod_id'::uuid, :'var_id'::uuid, :'opt_id'::uuid, :'opt_val_id'::uuid),
  true,
  'Admin assigns variant option value combination'
);

reset role;

select * from extensions.finish();
rollback;
