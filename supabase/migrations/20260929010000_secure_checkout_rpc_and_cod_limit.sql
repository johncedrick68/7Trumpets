-- Amend the installed implementation, preserving its locks, retries and snapshots.
-- Fail migration rather than silently patching an unexpected function body.
do $migration$
declare
  definition text;
  marker text := '  LOOP
    v_order_number :=';
  guard text := $guard$
  -- Database configuration is canonical; browser ceilings are never accepted.
  select value into v_checkout_payment from public.store_settings where key = 'payment' for share;
  if v_checkout_payment is null
     or pg_catalog.jsonb_typeof(v_checkout_payment) <> 'object'
     or pg_catalog.jsonb_typeof(v_checkout_payment->'cod_enabled') is distinct from 'boolean'
     or pg_catalog.jsonb_typeof(v_checkout_payment->'gcash_enabled') is distinct from 'boolean'
     or pg_catalog.jsonb_typeof(v_checkout_payment->'cod_max_minor') is distinct from 'number'
     or coalesce(v_checkout_payment->>'cod_max_minor', '') !~ '^[0-9]+$' then
    raise exception 'CHECKOUT_CONFIGURATION_UNAVAILABLE' using errcode = '22023';
  end if;
  if (v_checkout_payment->>'cod_max_minor')::numeric > 9007199254740991 then
    raise exception 'CHECKOUT_CONFIGURATION_UNAVAILABLE' using errcode = '22023';
  end if;
  if (p_payment_method = 'COD' and not (v_checkout_payment->>'cod_enabled')::boolean)
     or (p_payment_method = 'MANUAL_GCASH' and not (v_checkout_payment->>'gcash_enabled')::boolean) then
    raise exception 'CHECKOUT_PAYMENT_UNAVAILABLE' using errcode = '22023';
  end if;
  if p_payment_method = 'COD' and v_subtotal + p_shipping_minor > (v_checkout_payment->>'cod_max_minor')::bigint then
    raise exception 'COD_LIMIT_EXCEEDED' using errcode = '22023';
  end if;

$guard$;
begin
  definition := pg_catalog.pg_get_functiondef('public.checkout_order(uuid,text,jsonb,bigint,text,timestamptz,jsonb,text)'::regprocedure);
  definition := pg_catalog.replace(definition, pg_catalog.chr(13), '');
  if pg_catalog.strpos(definition, marker) = 0 or pg_catalog.strpos(definition, '  v_subtotal BIGINT := 0;') = 0 then
    raise exception 'Unexpected checkout implementation: manual migration review required';
  end if;
  definition := pg_catalog.replace(definition, '  v_subtotal BIGINT := 0;', '  v_subtotal BIGINT := 0;
  v_checkout_payment jsonb;');
  definition := pg_catalog.replace(definition, marker, guard || marker);
  execute definition;
end;
$migration$;

-- Named arguments distinguish the legacy overload from the nine-argument
-- function whose final customer-note parameter has a default.
create or replace function public.checkout_order(
  p_customer_id uuid, p_idempotency_key text, p_lines jsonb,
  p_shipping_minor bigint, p_payment_method text, p_gcash_expires_at timestamptz,
  p_delivery jsonb, p_fulfillment_method text, p_customer_note text default null
) returns public.orders language plpgsql security definer set search_path = '' as $$
declare v_order public.orders%rowtype;
begin
  if p_fulfillment_method not in ('SHIPMENT', 'STORE_PICKUP')
     or (p_fulfillment_method = 'STORE_PICKUP' and p_shipping_minor <> 0)
     or (p_fulfillment_method = 'STORE_PICKUP' and p_payment_method not in ('CASH', 'MANUAL_GCASH'))
     or (p_fulfillment_method = 'SHIPMENT' and p_payment_method not in ('COD', 'MANUAL_GCASH')) then
    raise exception 'invalid fulfillment checkout input' using errcode = '22023';
  end if;
  select * into v_order from public.checkout_order(
    p_customer_id => p_customer_id, p_idempotency_key => p_idempotency_key,
    p_lines => p_lines, p_shipping_minor => p_shipping_minor,
    p_payment_method => p_payment_method, p_gcash_expires_at => p_gcash_expires_at,
    p_delivery => p_delivery, p_customer_note => p_customer_note
  );
  update public.orders set fulfillment_method = p_fulfillment_method
  where id = v_order.id returning * into v_order;
  return v_order;
end;
$$;

revoke execute on function public.checkout_order(uuid,text,jsonb,bigint,text,timestamptz,jsonb,text) from public, anon, authenticated;
revoke execute on function public.checkout_order(uuid,text,jsonb,bigint,text,timestamptz,jsonb,text,text) from public, anon, authenticated;
grant execute on function public.checkout_order(uuid,text,jsonb,bigint,text,timestamptz,jsonb,text) to service_role;
grant execute on function public.checkout_order(uuid,text,jsonb,bigint,text,timestamptz,jsonb,text,text) to service_role;
