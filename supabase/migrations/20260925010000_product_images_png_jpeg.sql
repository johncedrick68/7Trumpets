-- Align the product media bucket with the server-validated upload contract.
-- File contents are still inspected before storage; MIME metadata alone is not trusted.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
WHERE id = 'product-images';
