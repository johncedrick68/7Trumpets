alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_options enable row level security;
alter table public.product_option_values enable row level security;
alter table public.variant_option_values enable row level security;
alter table public.product_images enable row level security;
alter table public.inventory enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.inventory_reservations enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.addresses enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.payments enable row level security;
alter table public.payment_submissions enable row level security;
alter table public.payment_events enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_owner_select
on public.profiles for select to authenticated
using (id = auth.uid());

create policy profiles_owner_update
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy categories_public_select
on public.categories for select to anon, authenticated
using (archived_at is null);

create policy products_public_select
on public.products for select to anon, authenticated
using (status = 'published');

create policy product_variants_public_select
on public.product_variants for select to anon, authenticated
using (
  status = 'active'
  and exists (
    select 1 from public.products
    where products.id = product_variants.product_id
      and products.status = 'published'
  )
);

create policy product_options_public_select
on public.product_options for select to anon, authenticated
using (
  exists (
    select 1 from public.products
    where products.id = product_options.product_id
      and products.status = 'published'
  )
);

create policy product_option_values_public_select
on public.product_option_values for select to anon, authenticated
using (
  exists (
    select 1 from public.products
    where products.id = product_option_values.product_id
      and products.status = 'published'
  )
);

create policy variant_option_values_public_select
on public.variant_option_values for select to anon, authenticated
using (
  exists (
    select 1
    from public.product_variants
    join public.products on products.id = product_variants.product_id
    where product_variants.id = variant_option_values.variant_id
      and product_variants.status = 'active'
      and products.status = 'published'
  )
);

create policy product_images_public_select
on public.product_images for select to anon, authenticated
using (
  exists (
    select 1 from public.products
    where products.id = product_images.product_id
      and products.status = 'published'
  )
  and (
    variant_id is null
    or exists (
      select 1 from public.product_variants
      where product_variants.id = product_images.variant_id
        and product_variants.product_id = product_images.product_id
        and product_variants.status = 'active'
    )
  )
);

create policy carts_owner_all
on public.carts for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy cart_items_owner_all
on public.cart_items for all to authenticated
using (
  exists (
    select 1 from public.carts
    where carts.id = cart_items.cart_id
      and carts.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.carts
    where carts.id = cart_items.cart_id
      and carts.user_id = auth.uid()
  )
);

create policy addresses_owner_all
on public.addresses for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy orders_owner_select
on public.orders for select to authenticated
using (user_id = auth.uid());

create policy order_items_owner_select
on public.order_items for select to authenticated
using (
  exists (
    select 1 from public.orders
    where orders.id = order_items.order_id
      and orders.user_id = auth.uid()
  )
);

create policy order_status_history_owner_select
on public.order_status_history for select to authenticated
using (
  exists (
    select 1 from public.orders
    where orders.id = order_status_history.order_id
      and orders.user_id = auth.uid()
  )
);

create policy payments_owner_select
on public.payments for select to authenticated
using (
  exists (
    select 1 from public.orders
    where orders.id = payments.order_id
      and orders.user_id = auth.uid()
  )
);

create policy payment_submissions_owner_select
on public.payment_submissions for select to authenticated
using (
  submitted_by = auth.uid()
  and exists (
    select 1
    from public.payments
    join public.orders on orders.id = payments.order_id
    where payments.id = payment_submissions.payment_id
      and orders.user_id = auth.uid()
  )
);

-- Keep schema discovery usable while preventing untrusted object creation.
revoke create on schema public from public, anon, authenticated;
grant usage on schema public to anon, authenticated, service_role;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

revoke all on table
  public.profiles,
  public.categories,
  public.products,
  public.product_variants,
  public.product_options,
  public.product_option_values,
  public.variant_option_values,
  public.product_images,
  public.inventory,
  public.inventory_movements,
  public.inventory_reservations,
  public.carts,
  public.cart_items,
  public.addresses,
  public.orders,
  public.order_items,
  public.order_status_history,
  public.payments,
  public.payment_submissions,
  public.payment_events,
  public.audit_logs
from public, anon, authenticated, service_role;

revoke all on table private.user_roles from public, anon, authenticated, service_role;

grant select on table
  public.categories,
  public.products,
  public.product_variants,
  public.product_options,
  public.product_option_values,
  public.variant_option_values,
  public.product_images
to anon, authenticated;

grant select on table public.profiles to authenticated;
grant update (display_name, phone) on table public.profiles to authenticated;
grant select, insert, update, delete on table
  public.carts,
  public.cart_items,
  public.addresses
to authenticated;

grant select on table
  public.profiles,
  public.categories,
  public.products,
  public.product_variants,
  public.product_options,
  public.product_option_values,
  public.variant_option_values,
  public.product_images,
  public.inventory,
  public.inventory_movements,
  public.inventory_reservations,
  public.carts,
  public.cart_items,
  public.addresses,
  public.orders,
  public.order_items,
  public.order_status_history,
  public.payments,
  public.payment_submissions,
  public.payment_events,
  public.audit_logs
to service_role;
grant select on table
  public.orders,
  public.order_items,
  public.order_status_history,
  public.payments,
  public.payment_submissions
to authenticated;

-- Do not inherit PostgreSQL's default PUBLIC execution for future project code.
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema private revoke execute on functions from public;

-- Exclude extension-owned routines so Supabase and installed extensions retain
-- their managed privileges. Trigger routines are never directly callable.
do $$
declare
  project_function record;
begin
  perform pg_catalog.set_config('search_path', '', true);

  for project_function in
    select
      p.oid,
      n.nspname,
      p.proname,
      pg_catalog.pg_get_function_identity_arguments(p.oid) as identity_arguments,
      p.prosecdef,
      p.prorettype
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and not (n.nspname = 'private' and p.proname = 'has_role')
      and not exists (
        select 1
        from pg_catalog.pg_depend d
        where d.classid = 'pg_catalog.pg_proc'::pg_catalog.regclass
          and d.objid = p.oid
          and d.deptype = 'e'
      )
  loop
    execute pg_catalog.format(
      'revoke all on function %I.%I(%s) from public, anon, authenticated, service_role',
      project_function.nspname,
      project_function.proname,
      project_function.identity_arguments
    );

  end loop;
end
$$;

grant execute on function public.manage_user_role(uuid, text, boolean) to authenticated;

grant execute on function public.checkout_order(uuid, text, jsonb, bigint, text, timestamptz, jsonb, text) to service_role;
grant execute on function public.transition_order(uuid, text, text, text, uuid, text, jsonb) to service_role;
grant execute on function private.reserve_inventory(uuid, uuid, integer, timestamptz, text, uuid) to service_role;
grant execute on function private.transition_inventory_reservation(uuid, text, text, uuid, text) to service_role;
grant execute on function private.start_gcash_review(uuid, uuid, uuid, text, text, jsonb) to service_role;
grant execute on function private.settle_cod_payment(uuid, uuid, text, text, jsonb) to service_role;
grant execute on function private.submit_gcash_proof(uuid, uuid, bigint, text, text, timestamptz, text, text) to service_role;
grant execute on function private.approve_gcash_submission(uuid, uuid, uuid, text, text) to service_role;
grant execute on function private.reject_gcash_submission(uuid, uuid, uuid, text, text) to service_role;
grant execute on function private.close_expired_gcash_payment(uuid, uuid, text, text) to service_role;
