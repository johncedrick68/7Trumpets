-- Public catalog availability exposes only a boolean signal for published,
-- active variants. Authoritative quantities remain protected by inventory RLS.

create or replace function public.get_public_variant_availability()
returns table (variant_id uuid, is_available boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    variants.id as variant_id,
    coalesce((inventory.on_hand - inventory.reserved) > 0, false) as is_available
  from public.product_variants as variants
  join public.products as products on products.id = variants.product_id
  left join public.inventory as inventory on inventory.variant_id = variants.id
  where products.status = 'published'
    and variants.status = 'active';
$$;

revoke all on function public.get_public_variant_availability() from public;
grant execute on function public.get_public_variant_availability() to anon, authenticated;

