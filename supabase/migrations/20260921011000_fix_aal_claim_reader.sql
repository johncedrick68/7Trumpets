-- Read AAL from PostgREST's trusted JWT claims GUC without granting the
-- restricted role access to the auth schema.

GRANT app_rls_role_reader TO postgres;

CREATE OR REPLACE FUNCTION private.has_role(required_role text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  subject_id uuid := private.current_auth_uid();
  jwt_claims jsonb := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
BEGIN
  IF required_role IS NULL
     OR required_role NOT IN ('customer', 'cashier', 'admin', 'super_admin') THEN
    RAISE EXCEPTION 'unsupported role: %', required_role USING errcode = '22023';
  END IF;

  IF subject_id IS NULL THEN
    RETURN false;
  END IF;

  IF required_role IN ('admin', 'super_admin')
     AND coalesce(jwt_claims->>'aal', 'aal1') <> 'aal2' THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM private.user_roles AS ur
    WHERE ur.user_id = subject_id AND ur.role = required_role
  );
END;
$$;

REVOKE app_rls_role_reader FROM postgres;
