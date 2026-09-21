-- Atomic product-media ordering for the admin catalog.
-- The image with the lowest position is the storefront primary image.

create or replace function public.admin_reorder_product_image(
  p_image_id uuid,
  p_action text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.require_admin_aal2();
  v_product_id uuid;
  v_ids uuid[];
  v_current integer;
  v_target integer;
begin
  if p_image_id is null or p_action not in ('primary', 'up', 'down') then
    raise exception 'invalid image reorder request' using errcode = '22023';
  end if;

  select product_id into v_product_id
  from public.product_images
  where id = p_image_id;

  if v_product_id is null then
    raise exception 'product image not found' using errcode = '22023';
  end if;

  -- Serialize ordering changes for every image belonging to this product.
  perform 1 from public.product_images
  where product_id = v_product_id
  order by position, created_at, id
  for update;

  select array_agg(id order by position, created_at, id)
  into v_ids
  from public.product_images
  where product_id = v_product_id;

  v_current := array_position(v_ids, p_image_id);
  v_target := case p_action
    when 'primary' then 1
    when 'up' then greatest(1, v_current - 1)
    when 'down' then least(array_length(v_ids, 1), v_current + 1)
  end;

  if v_target <> v_current then
    v_ids := array_remove(v_ids, p_image_id);
    v_ids := v_ids[1:v_target - 1] || array[p_image_id] || v_ids[v_target:array_length(v_ids, 1)];
  end if;

  update public.product_images as image
  set position = ordered.position
  from (
    select id, ordinality::integer - 1 as position
    from unnest(v_ids) with ordinality as item(id, ordinality)
  ) as ordered
  where image.id = ordered.id;

  insert into public.audit_logs (actor_id, actor_role, action, entity, entity_id, new_values)
  values (
    v_actor,
    'admin',
    'product_image.reordered',
    'product_image',
    p_image_id,
    jsonb_build_object('product_id', v_product_id, 'action', p_action, 'position', v_target - 1)
  );

  return true;
end;
$$;

alter function public.admin_reorder_product_image(uuid, text) owner to postgres;
revoke all on function public.admin_reorder_product_image(uuid, text) from public, anon;
grant execute on function public.admin_reorder_product_image(uuid, text) to authenticated;
