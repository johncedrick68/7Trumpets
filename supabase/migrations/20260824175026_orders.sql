create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default (
    'ORD-'
    || to_char(current_timestamp at time zone 'UTC', 'YYYYMMDD')
    || '-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
  ),
  user_id uuid references auth.users (id) on delete set null,
  idempotency_key text not null unique check (btrim(idempotency_key) <> ''),
  status text not null default 'CONFIRMED' check (status in (
    'CONFIRMED', 'PROCESSING', 'PACKING', 'READY_FOR_SHIPMENT',
    'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED',
    'COMPLETED', 'CANCELLED', 'DELIVERY_FAILED'
  )),
  currency_code text not null default 'PHP'
    check (currency_code ~ '^[A-Z]{3}$'),
  subtotal_minor bigint not null check (subtotal_minor >= 0),
  discount_minor bigint not null default 0 check (discount_minor >= 0),
  shipping_minor bigint not null default 0 check (shipping_minor >= 0),
  total_minor bigint not null check (total_minor >= 0),
  customer_email text not null check (btrim(customer_email) <> ''),
  recipient_name text not null check (btrim(recipient_name) <> ''),
  recipient_phone text not null check (btrim(recipient_phone) <> ''),
  address_line1 text not null check (btrim(address_line1) <> ''),
  address_line2 text,
  barangay text,
  city_municipality text not null check (btrim(city_municipality) <> ''),
  province text not null check (btrim(province) <> ''),
  postal_code text not null check (btrim(postal_code) <> ''),
  country_code text not null default 'PH'
    check (country_code ~ '^[A-Z]{2}$'),
  customer_note text,
  cancellation_reason text,
  delivery_failure_reason text,
  placed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (discount_minor <= subtotal_minor),
  check (total_minor = subtotal_minor - discount_minor + shipping_minor),
  check (address_line2 is null or btrim(address_line2) <> ''),
  check (barangay is null or btrim(barangay) <> ''),
  check (customer_note is null or btrim(customer_note) <> ''),
  check (status <> 'CANCELLED' or nullif(btrim(cancellation_reason), '') is not null),
  check (
    status <> 'DELIVERY_FAILED'
    or nullif(btrim(delivery_failure_reason), '') is not null
  ),
  check (order_number ~ '^ORD-[0-9]{8}-[0-9A-F]{10}$')
);

create index orders_user_created_idx
on public.orders (user_id, created_at desc);

create index orders_status_created_idx
on public.orders (status, created_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  product_id uuid references public.products (id) on delete set null,
  variant_id uuid references public.product_variants (id) on delete set null,
  product_name text not null check (btrim(product_name) <> ''),
  variant_name text,
  sku text not null check (btrim(sku) <> ''),
  selected_options jsonb not null default '{}'::jsonb
    check (jsonb_typeof(selected_options) = 'object'),
  quantity integer not null check (quantity > 0),
  unit_price_minor bigint not null check (unit_price_minor >= 0),
  unit_discount_minor bigint not null default 0 check (unit_discount_minor >= 0),
  line_subtotal_minor bigint not null check (line_subtotal_minor >= 0),
  line_discount_minor bigint not null check (line_discount_minor >= 0),
  line_total_minor bigint not null check (line_total_minor >= 0),
  created_at timestamptz not null default now(),
  check (variant_name is null or btrim(variant_name) <> ''),
  check (unit_discount_minor <= unit_price_minor),
  check (line_subtotal_minor = unit_price_minor * quantity),
  check (line_discount_minor = unit_discount_minor * quantity),
  check (line_total_minor = line_subtotal_minor - line_discount_minor)
);

create index order_items_order_id_idx on public.order_items (order_id);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  from_status text check (from_status is null or from_status in (
    'CONFIRMED', 'PROCESSING', 'PACKING', 'READY_FOR_SHIPMENT',
    'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED',
    'COMPLETED', 'CANCELLED', 'DELIVERY_FAILED'
  )),
  to_status text not null check (to_status in (
    'CONFIRMED', 'PROCESSING', 'PACKING', 'READY_FOR_SHIPMENT',
    'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED',
    'COMPLETED', 'CANCELLED', 'DELIVERY_FAILED'
  )),
  note text,
  source text not null check (btrim(source) <> '' and length(source) <= 50),
  changed_by uuid references auth.users (id) on delete set null,
  idempotency_key text not null
    check (btrim(idempotency_key) <> '' and length(idempotency_key) <= 128),
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object'
    and pg_column_size(metadata) <= 16384
  ),
  created_at timestamptz not null default now(),
  unique (order_id, idempotency_key),
  check (note is null or btrim(note) <> '')
);

create index order_status_history_order_created_idx
on public.order_status_history (order_id, created_at desc);

create function private.validate_order_transition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  payment_method text;
  payment_status text;
begin
  if new.status = old.status then
    return new;
  end if;

  if (old.status, new.status) not in (
    ('CONFIRMED', 'PROCESSING'),
    ('CONFIRMED', 'CANCELLED'),
    ('PROCESSING', 'PACKING'),
    ('PROCESSING', 'READY_FOR_SHIPMENT'),
    ('PROCESSING', 'CANCELLED'),
    ('PACKING', 'READY_FOR_SHIPMENT'),
    ('PACKING', 'CANCELLED'),
    ('READY_FOR_SHIPMENT', 'SHIPPED'),
    ('READY_FOR_SHIPMENT', 'CANCELLED'),
    ('SHIPPED', 'IN_TRANSIT'),
    ('SHIPPED', 'OUT_FOR_DELIVERY'),
    ('SHIPPED', 'DELIVERY_FAILED'),
    ('IN_TRANSIT', 'OUT_FOR_DELIVERY'),
    ('IN_TRANSIT', 'DELIVERY_FAILED'),
    ('OUT_FOR_DELIVERY', 'DELIVERED'),
    ('OUT_FOR_DELIVERY', 'DELIVERY_FAILED'),
    ('DELIVERED', 'COMPLETED'),
    ('DELIVERY_FAILED', 'IN_TRANSIT'),
    ('DELIVERY_FAILED', 'OUT_FOR_DELIVERY'),
    ('DELIVERY_FAILED', 'CANCELLED')
  ) then
    raise exception 'invalid order transition: % -> %', old.status, new.status
      using errcode = '23514';
  end if;

  if old.status = 'CONFIRMED' and new.status = 'PROCESSING' then
    select p.method, p.status
    into payment_method, payment_status
    from public.payments as p
    where p.order_id = new.id;

    if payment_method is null
       or (payment_method = 'MANUAL_GCASH' and payment_status <> 'PAID')
       or (payment_method = 'COD' and payment_status not in ('UNPAID', 'PAID')) then
      raise exception 'payment is not eligible for order processing'
        using errcode = '23514';
    end if;

    if not exists (
      select 1 from public.inventory_reservations as r
      where r.order_id = new.id
    ) or exists (
      select 1 from public.inventory_reservations as r
      where r.order_id = new.id and r.status <> 'consumed'
    ) then
      raise exception 'all order reservations must be consumed before processing'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

alter function private.validate_order_transition() owner to postgres;
revoke all on function private.validate_order_transition() from public;

create trigger orders_validate_transition
before update of status on public.orders
for each row execute function private.validate_order_transition();

create function private.record_initial_order_status()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status <> 'CONFIRMED' then
    raise exception 'initial order status must be CONFIRMED' using errcode = '23514';
  end if;

  insert into public.order_status_history (
    order_id, from_status, to_status, source, idempotency_key
  ) values (
    new.id, null, 'CONFIRMED', 'system', 'initial:' || new.id::text
  );
  return new;
end;
$$;

alter function private.record_initial_order_status() owner to postgres;
revoke all on function private.record_initial_order_status() from public;

create trigger orders_record_initial_status
after insert on public.orders
for each row execute function private.record_initial_order_status();

create function private.reject_append_only_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception '% is append-only', tg_table_name
    using errcode = '55000';
end;
$$;

alter function private.reject_append_only_mutation() owner to postgres;
revoke all on function private.reject_append_only_mutation() from public;

create trigger order_status_history_append_only
before update or delete on public.order_status_history
for each row execute function private.reject_append_only_mutation();

-- SECURITY DEFINER permits only the later service_role grant to perform the
-- locked order update and matching history insert as one operation.
create function public.transition_order(
  p_order_id uuid,
  p_to_status text,
  p_note text,
  p_source text,
  p_changed_by uuid,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_order public.orders%rowtype;
  prior_history public.order_status_history%rowtype;
  previous_status text;
begin
  if p_order_id is null
     or p_to_status is null
     or nullif(pg_catalog.btrim(p_source), '') is null
     or nullif(pg_catalog.btrim(p_idempotency_key), '') is null
     or p_metadata is null then
    raise exception 'invalid order transition input' using errcode = '22023';
  end if;

  select * into current_order
  from public.orders as o
  where o.id = p_order_id
  for update;

  if not found then
    raise exception 'order not found' using errcode = 'P0002';
  end if;

  select * into prior_history
  from public.order_status_history as h
  where h.order_id = p_order_id
    and h.idempotency_key = p_idempotency_key;

  if found then
    if prior_history.to_status is distinct from p_to_status
       or prior_history.note is distinct from p_note
       or prior_history.source is distinct from p_source
       or prior_history.changed_by is distinct from p_changed_by
       or prior_history.metadata is distinct from p_metadata then
      raise exception 'idempotency key conflicts with an existing transition'
        using errcode = '23505';
    end if;
    return current_order;
  end if;

  if current_order.status = p_to_status then
    raise exception 'order is already in status %', p_to_status
      using errcode = '23514';
  end if;

  if p_to_status = 'CANCELLED' and exists (
    select 1
    from public.inventory_reservations as r
    where r.order_id = p_order_id and r.status = 'active'
  ) then
    raise exception 'active reservations require final resolution before cancellation'
      using errcode = 'P0001';
  end if;

  previous_status := current_order.status;

  update public.orders
  set status = p_to_status,
      cancellation_reason = case
        when p_to_status = 'CANCELLED' then p_note
        else cancellation_reason
      end,
      delivery_failure_reason = case
        when p_to_status = 'DELIVERY_FAILED' then p_note
        else delivery_failure_reason
      end
  where id = p_order_id
  returning * into current_order;

  insert into public.order_status_history (
    order_id, from_status, to_status, note, source, changed_by,
    idempotency_key, metadata
  ) values (
    p_order_id, previous_status, p_to_status, p_note, p_source,
    p_changed_by, p_idempotency_key, p_metadata
  );

  return current_order;
end;
$$;

alter function public.transition_order(uuid, text, text, text, uuid, text, jsonb)
owner to postgres;
revoke all on function public.transition_order(uuid, text, text, text, uuid, text, jsonb)
from public, anon, authenticated;

create trigger orders_set_updated_at
before update on public.orders
for each row execute function private.set_updated_at();
