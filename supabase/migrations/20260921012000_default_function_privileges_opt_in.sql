-- Future functions in public are private by default. Every intentionally exposed
-- RPC must opt in with an explicit GRANT EXECUTE to the exact intended role.
-- Existing function privileges are not changed by ALTER DEFAULT PRIVILEGES.

ALTER DEFAULT PRIVILEGES FOR ROLE postgres
IN SCHEMA public
REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres
IN SCHEMA public
REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated, service_role;
