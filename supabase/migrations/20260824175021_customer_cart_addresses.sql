create table public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts (id) on delete cascade,
  variant_id uuid not null references public.product_variants (id) on delete restrict,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, variant_id)
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text,
  recipient_name text not null check (btrim(recipient_name) <> ''),
  phone text not null check (btrim(phone) <> ''),
  address_line1 text not null check (btrim(address_line1) <> ''),
  address_line2 text,
  barangay text,
  city_municipality text not null check (btrim(city_municipality) <> ''),
  province text not null check (btrim(province) <> ''),
  postal_code text not null check (btrim(postal_code) <> ''),
  country_code text not null default 'PH'
    check (country_code ~ '^[A-Z]{2}$'),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (label is null or btrim(label) <> ''),
  check (address_line2 is null or btrim(address_line2) <> ''),
  check (barangay is null or btrim(barangay) <> '')
);

create unique index addresses_one_default_per_user_uidx
on public.addresses (user_id)
where is_default;

create trigger carts_set_updated_at
before update on public.carts
for each row execute function private.set_updated_at();

create trigger cart_items_set_updated_at
before update on public.cart_items
for each row execute function private.set_updated_at();

create trigger addresses_set_updated_at
before update on public.addresses
for each row execute function private.set_updated_at();
