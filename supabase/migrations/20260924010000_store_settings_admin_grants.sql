-- Allow authenticated requests to reach the existing admin-only RLS policy.
-- AAL2 is enforced by the server action; RLS still requires admin/super_admin.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.store_settings FROM anon;
REVOKE DELETE ON TABLE public.store_settings FROM authenticated;
GRANT SELECT ON TABLE public.store_settings TO anon, authenticated;
GRANT INSERT, UPDATE ON TABLE public.store_settings TO authenticated;
