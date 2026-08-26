-- Keep future public functions fail-closed until a migration grants an intended caller.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.admin_save_category(UUID, TEXT, TEXT, TEXT, UUID, INTEGER, BOOLEAN) FROM PUBLIC, anon, service_role;
REVOKE EXECUTE ON FUNCTION public.admin_save_product(UUID, UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, service_role;
REVOKE EXECUTE ON FUNCTION public.admin_save_variant(UUID, UUID, TEXT, TEXT, BIGINT, BIGINT, TEXT) FROM PUBLIC, anon, service_role;
REVOKE EXECUTE ON FUNCTION public.admin_adjust_inventory(UUID, INTEGER, TEXT, TEXT, TEXT) FROM PUBLIC, anon, service_role;
REVOKE EXECUTE ON FUNCTION public.admin_save_product_option(UUID, TEXT, UUID, INTEGER) FROM PUBLIC, anon, service_role;
REVOKE EXECUTE ON FUNCTION public.admin_save_option_value(UUID, UUID, TEXT, UUID, INTEGER) FROM PUBLIC, anon, service_role;
REVOKE EXECUTE ON FUNCTION public.admin_set_variant_option_value(UUID, UUID, UUID, UUID) FROM PUBLIC, anon, service_role;
REVOKE EXECUTE ON FUNCTION public.admin_save_product_image(UUID, TEXT, TEXT, UUID, INTEGER) FROM PUBLIC, anon, service_role;
REVOKE EXECUTE ON FUNCTION public.admin_delete_product_image(UUID) FROM PUBLIC, anon, service_role;

GRANT EXECUTE ON FUNCTION public.admin_save_category(UUID, TEXT, TEXT, TEXT, UUID, INTEGER, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_product(UUID, UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_variant(UUID, UUID, TEXT, TEXT, BIGINT, BIGINT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_inventory(UUID, INTEGER, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_product_option(UUID, TEXT, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_option_value(UUID, UUID, TEXT, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_variant_option_value(UUID, UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_product_image(UUID, TEXT, TEXT, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_product_image(UUID) TO authenticated;
