\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('request.jwt.claims', '{"sub":"af4422c6-9573-41e4-9281-d759dcce3fab","aal":"aal2"}', true);
SELECT id FROM public.register_sessions
WHERE id = '90000000-0000-0000-0000-000000000010'
FOR UPDATE;
SELECT pg_sleep(3);
SELECT public.create_pos_sale(
  '[{"variant_id":"a1000000-0001-0000-0000-000000000001","quantity":1}]',
  'CASH', 100000, 'Race Test', '09000000000', 'race@1968.local',
  '90000000-0000-0000-0000-000000000010', 'race-sale-first'
);
ROLLBACK;
