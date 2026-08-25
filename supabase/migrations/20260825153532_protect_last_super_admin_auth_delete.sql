-- Serialize Auth and role deletion before enforcing the durable role invariant.
-- SECURITY DEFINER is required because GoTrue cannot read private.user_roles.
CREATE FUNCTION private.protect_last_super_admin_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_WHEN = 'BEFORE' THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(719736238512950481::BIGINT);
    RETURN NULL;
  END IF;

  IF EXISTS (
       SELECT 1 FROM deleted_user_roles WHERE role = 'super_admin'
     ) AND NOT EXISTS (
       SELECT 1 FROM private.user_roles WHERE role = 'super_admin'
     ) THEN
    RAISE EXCEPTION 'LAST_SUPER_ADMIN_REQUIRED' USING ERRCODE = '23514';
  END IF;

  RETURN NULL;
END;
$$;

ALTER FUNCTION private.protect_last_super_admin_delete() OWNER TO postgres;
REVOKE ALL ON FUNCTION private.protect_last_super_admin_delete()
  FROM PUBLIC, anon, authenticated, service_role;

-- Lock before Auth rows so concurrent Auth deletion matches role-management order.
CREATE TRIGGER auth_users_serialize_role_delete
BEFORE DELETE ON auth.users
FOR EACH STATEMENT
EXECUTE FUNCTION private.protect_last_super_admin_delete();

CREATE TRIGGER user_roles_serialize_delete
BEFORE DELETE ON private.user_roles
FOR EACH STATEMENT
EXECUTE FUNCTION private.protect_last_super_admin_delete();

CREATE TRIGGER user_roles_preserve_last_super_admin
AFTER DELETE ON private.user_roles
REFERENCING OLD TABLE AS deleted_user_roles
FOR EACH STATEMENT
EXECUTE FUNCTION private.protect_last_super_admin_delete();
