-- Keep fulfillment selection and order creation in one database transaction.
-- This overload preserves the verified checkout implementation while making
-- fulfillment explicit instead of inferring it from payment or shipping cost.

create or replace function public.checkout_order(
  p_customer_id uuid,
  p_idempotency_key text,
  p_lines jsonb,
  p_shipping_minor bigint,
  p_payment_method text,
  p_gcash_expires_at timestamptz,
  p_delivery jsonb,
  p_fulfillment_method text,
  p_customer_note text default null
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  if p_fulfillment_method not in ('SHIPMENT', 'STORE_PICKUP')
     or (p_fulfillment_method = 'STORE_PICKUP' and p_shipping_minor <> 0)
     or (p_fulfillment_method = 'STORE_PICKUP' and p_payment_method not in ('CASH', 'MANUAL_GCASH'))
     or (p_fulfillment_method = 'SHIPMENT' and p_payment_method not in ('COD', 'MANUAL_GCASH')) then
    raise exception 'invalid fulfillment checkout input' using errcode = '22023';
  end if;

  select * into v_order
  from public.checkout_order(
    p_customer_id,
    p_idempotency_key,
    p_lines,
    p_shipping_minor,
    p_payment_method,
    p_gcash_expires_at,
    p_delivery,
    p_customer_note
  );

  update public.orders
  set fulfillment_method = p_fulfillment_method
  where id = v_order.id
  returning * into v_order;

  return v_order;
end;
$$;

alter function public.checkout_order(uuid, text, jsonb, bigint, text, timestamptz, jsonb, text, text) owner to postgres;
revoke all on function public.checkout_order(uuid, text, jsonb, bigint, text, timestamptz, jsonb, text, text) from public, anon;
grant execute on function public.checkout_order(uuid, text, jsonb, bigint, text, timestamptz, jsonb, text, text) to service_role, authenticated;
