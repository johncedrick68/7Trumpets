create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories (id) on delete restrict,
  slug text not null unique,
  name text not null,
  description text,
  position integer not null default 0 check (position >= 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (slug = lower(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  check (btrim(name) <> ''),
  check (parent_id is null or parent_id <> id)
);

create index categories_parent_id_idx on public.categories (parent_id);

create function private.reject_category_cycle()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.parent_id is null then
    return new;
  end if;

  -- Serialize hierarchy writes so two concurrent moves cannot create a cycle.
  perform pg_catalog.pg_advisory_xact_lock(734726836927164211::bigint);

  if exists (
    with recursive ancestors (id, parent_id) as (
      select c.id, c.parent_id
      from public.categories as c
      where c.id = new.parent_id
      union
      select c.id, c.parent_id
      from public.categories as c
      join ancestors as a on c.id = a.parent_id
    )
    select 1 from ancestors where id = new.id
  ) then
    raise exception 'category hierarchy cycle detected'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

alter function private.reject_category_cycle() owner to postgres;
revoke all on function private.reject_category_cycle() from public;

create trigger categories_reject_cycle
before insert or update of parent_id on public.categories
for each row execute function private.reject_category_cycle();

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories (id) on delete set null,
  slug text not null unique,
  name text not null,
  description text,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (slug = lower(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  check (btrim(name) <> '')
);

create index products_category_status_idx
on public.products (category_id, status);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  sku text not null unique,
  name text,
  price_minor bigint not null check (price_minor >= 0),
  compare_at_price_minor bigint,
  status text not null default 'active'
    check (status in ('active', 'inactive', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, id),
  check (sku = upper(btrim(sku)) and btrim(sku) <> ''),
  check (name is null or btrim(name) <> ''),
  check (
    compare_at_price_minor is null
    or compare_at_price_minor >= price_minor
  )
);

create index product_variants_product_status_idx
on public.product_variants (product_id, status);

create table public.product_options (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  unique (product_id, id)
);

create unique index product_options_product_name_uidx
on public.product_options (product_id, lower(name));

create index product_options_product_position_idx
on public.product_options (product_id, position);

create table public.product_option_values (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null,
  option_id uuid not null,
  value text not null check (btrim(value) <> ''),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  unique (product_id, option_id, id),
  foreign key (product_id, option_id)
    references public.product_options (product_id, id) on delete cascade
);

create unique index product_option_values_option_value_uidx
on public.product_option_values (option_id, lower(value));

create index product_option_values_option_position_idx
on public.product_option_values (option_id, position);

create table public.variant_option_values (
  product_id uuid not null,
  variant_id uuid not null,
  option_id uuid not null,
  option_value_id uuid not null,
  primary key (variant_id, option_id),
  foreign key (product_id, variant_id)
    references public.product_variants (product_id, id) on delete cascade,
  foreign key (product_id, option_id)
    references public.product_options (product_id, id) on delete cascade,
  foreign key (product_id, option_id, option_value_id)
    references public.product_option_values (product_id, option_id, id)
    on delete cascade
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  variant_id uuid,
  storage_path text not null unique check (btrim(storage_path) <> ''),
  alt_text text not null check (btrim(alt_text) <> ''),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  foreign key (product_id, variant_id)
    references public.product_variants (product_id, id) on delete cascade
);

create index product_images_product_position_idx
on public.product_images (product_id, position);

create trigger categories_set_updated_at
before update on public.categories
for each row execute function private.set_updated_at();

create trigger products_set_updated_at
before update on public.products
for each row execute function private.set_updated_at();

create trigger product_variants_set_updated_at
before update on public.product_variants
for each row execute function private.set_updated_at();
