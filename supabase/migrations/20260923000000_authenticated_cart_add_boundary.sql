-- Authenticated cart-add boundary. Cart contents do not reserve inventory, but
-- requested quantities must still be validated against authoritative stock.

create or replace function public.get_public_variant_availability()
returns table (variant_id uuid, is_available boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    variants.id as variant_id,
    coalesce(
      (inventory.on_hand - inventory.reserved - inventory.safety_stock) > 0,
      false
    ) as is_available
  from public.product_variants as variants
  join public.products as products on products.id = variants.product_id
  left join public.inventory as inventory on inventory.variant_id = variants.id
  where products.status = 'published'
    and variants.status = 'active';
$$;

revoke all on function public.get_public_variant_availability() from public;
grant execute on function public.get_public_variant_availability() to anon, authenticated;

create or replace function public.add_authenticated_cart_item(
  p_variant_id uuid,
  p_quantity integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_cart_id uuid;
  v_existing_quantity integer := 0;
  v_available integer;
  v_line_quantity integer;
  v_item_count integer;
begin
  if v_user_id is null then
    raise exception 'CART_AUTH_REQUIRED' using errcode = '42501';
  end if;

  if p_variant_id is null or p_quantity is null or p_quantity <= 0 then
    raise exception 'CART_INVALID_QUANTITY' using errcode = '22023';
  end if;

  select inventory.on_hand - inventory.reserved - inventory.safety_stock
    into v_available
  from public.product_variants as variants
  join public.products as products on products.id = variants.product_id
  join public.inventory as inventory on inventory.variant_id = variants.id
  where variants.id = p_variant_id
    and variants.status = 'active'
    and products.status = 'published'
  for update of inventory;

  if not found then
    raise exception 'CART_VARIANT_UNAVAILABLE' using errcode = 'P0002';
  end if;

  if v_available <= 0 then
    raise exception 'CART_OUT_OF_STOCK' using errcode = 'P0001';
  end if;

  insert into public.carts (user_id)
  values (v_user_id)
  on conflict (user_id) do update set user_id = excluded.user_id
  returning id into v_cart_id;

  select quantity into v_existing_quantity
  from public.cart_items
  where cart_id = v_cart_id and variant_id = p_variant_id
  for update;

  v_line_quantity := coalesce(v_existing_quantity, 0) + p_quantity;
  if v_line_quantity > v_available then
    raise exception 'CART_QUANTITY_EXCEEDS_STOCK' using errcode = 'P0001';
  end if;

  insert into public.cart_items (cart_id, variant_id, quantity)
  values (v_cart_id, p_variant_id, v_line_quantity)
  on conflict (cart_id, variant_id)
  do update set quantity = excluded.quantity;

  select coalesce(sum(quantity), 0)::integer into v_item_count
  from public.cart_items
  where cart_id = v_cart_id;

  return jsonb_build_object(
    'line_quantity', v_line_quantity,
    'item_count', v_item_count
  );
end;
$$;

revoke all on function public.add_authenticated_cart_item(uuid, integer) from public;
grant execute on function public.add_authenticated_cart_item(uuid, integer) to authenticated;
