\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('request.jwt.claims', '{"sub":"af4422c6-9573-41e4-9281-d759dcce3fab","aal":"aal2"}', true);
SELECT public.close_register_session(
  '90000000-0000-0000-0000-000000000010',
  100000,
  'race close'
);
COMMIT;
