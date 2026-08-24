insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values
  (
    'product-images',
    'product-images',
    true,
    5242880,
    array['image/webp']::text[]
  ),
  (
    'payment-receipts',
    'payment-receipts',
    false,
    2097152,
    array['image/jpeg', 'image/png', 'image/webp']::text[]
  );

create policy product_images_public_read
on storage.objects for select to public
using (bucket_id = 'product-images');
