-- PostgreSQL grants PUBLIC execute on new functions globally by default.
-- A schema-scoped REVOKE cannot subtract that global baseline, so this owner-wide
-- default is required. Existing functions and their explicit grants are unchanged.

ALTER DEFAULT PRIVILEGES FOR ROLE postgres
REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;
