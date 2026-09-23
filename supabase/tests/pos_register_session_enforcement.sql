\set ON_ERROR_STOP on

BEGIN;

-- All fixtures are rolled back. Claims emulate PostgREST's trusted request
-- context so the SECURITY DEFINER boundary is exercised as deployed.
SET LOCAL ROLE postgres;

INSERT INTO public.register_sessions (
  id, cashier_id, status, opened_at, closed_at, opening_cash_minor, expected_cash_minor, actual_cash_minor
) VALUES
  ('90000000-0000-0000-0000-000000000001', 'af4422c6-9573-41e4-9281-d759dcce3fab', 'OPEN', now(), NULL, 100000, 100000, NULL),
  ('90000000-0000-0000-0000-000000000002', 'af4422c6-9573-41e4-9281-d759dcce3fab', 'CLOSED', now(), now(), 100000, 100000, 100000),
  ('90000000-0000-0000-0000-000000000003', '20820841-d0f5-449d-a7d4-2f3f00c4b5bd', 'OPEN', now(), NULL, 100000, 100000, NULL);

CREATE OR REPLACE FUNCTION pg_temp.call_test_sale(
  session_id uuid,
  idempotency_key text DEFAULT gen_random_uuid()::text
) RETURNS jsonb
LANGUAGE sql
AS $test$
  SELECT public.create_pos_sale(
    jsonb_build_array(jsonb_build_object(
      'variant_id', 'a1000000-0001-0000-0000-000000000001',
      'quantity', 1
    )),
    'CASH',
    100000,
    'Local POS Test',
    '09000000000',
    'pos.test@1968.local',
    session_id,
    idempotency_key
  );
$test$;

CREATE OR REPLACE FUNCTION pg_temp.expect_error(
  label text,
  statement text,
  expected_message text
) RETURNS void
LANGUAGE plpgsql
AS $test$
BEGIN
  EXECUTE statement;
  RAISE EXCEPTION 'FAIL %: expected %', label, expected_message;
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM = 'FAIL ' || label || ': expected ' || expected_message THEN
      RAISE;
    END IF;
    IF position(expected_message IN SQLERRM) = 0 THEN
      RAISE EXCEPTION 'FAIL %: expected %, got %', label, expected_message, SQLERRM;
    END IF;
    RAISE NOTICE 'PASS % -> %', label, expected_message;
END;
$test$;

-- Anonymous is rejected.
SELECT set_config('request.jwt.claims', '{}', true);
SELECT pg_temp.expect_error(
  'anonymous caller',
  $$SELECT pg_temp.call_test_sale('90000000-0000-0000-0000-000000000001')$$,
  'unauthenticated'
);

-- A customer at AAL2 still fails the role boundary.
SELECT set_config('request.jwt.claims', '{"sub":"20820841-d0f5-449d-a7d4-2f3f00c4b5bd","aal":"aal2"}', true);
SELECT pg_temp.expect_error(
  'customer role',
  $$SELECT pg_temp.call_test_sale('90000000-0000-0000-0000-000000000003')$$,
  'insufficient role for POS sale'
);

-- A staff actor at AAL1 is rejected before register or inventory mutation.
SELECT set_config('request.jwt.claims', '{"sub":"af4422c6-9573-41e4-9281-d759dcce3fab","aal":"aal1"}', true);
SELECT pg_temp.expect_error(
  'AAL1 admin',
  $$SELECT pg_temp.call_test_sale('90000000-0000-0000-0000-000000000001')$$,
  'AAL2 required for POS sale'
);

SELECT set_config('request.jwt.claims', '{"sub":"af4422c6-9573-41e4-9281-d759dcce3fab","aal":"aal2"}', true);

SELECT pg_temp.expect_error(
  'missing session',
  $$SELECT pg_temp.call_test_sale(NULL)$$,
  'POS_REGISTER_SESSION_REQUIRED'
);
SELECT pg_temp.expect_error(
  'unknown session',
  $$SELECT pg_temp.call_test_sale('90000000-0000-0000-0000-000000000099')$$,
  'POS_REGISTER_SESSION_NOT_FOUND'
);
SELECT pg_temp.expect_error(
  'another cashier session',
  $$SELECT pg_temp.call_test_sale('90000000-0000-0000-0000-000000000003')$$,
  'POS_REGISTER_SESSION_NOT_OWNED'
);
SELECT pg_temp.expect_error(
  'closed session',
  $$SELECT pg_temp.call_test_sale('90000000-0000-0000-0000-000000000002')$$,
  'POS_REGISTER_SESSION_CLOSED'
);
SELECT pg_temp.expect_error(
  'open session invalid inventory',
  $$SELECT public.create_pos_sale('[{"variant_id":"a1000000-0001-0000-0000-000000000001","quantity":999999}]', 'CASH', 999999999, 'Test', '09000000000', 'pos.test@1968.local', '90000000-0000-0000-0000-000000000001', 'invalid-stock')$$,
  'insufficient inventory'
);

-- Authorized AAL2 actor with their OPEN register succeeds.
SELECT pg_temp.call_test_sale(
  '90000000-0000-0000-0000-000000000001',
  'pos-register-boundary-success'
) AS successful_sale;

-- A replay cannot create a second order under the same canonical key.
SELECT pg_temp.expect_error(
  'idempotency replay',
  $$SELECT pg_temp.call_test_sale('90000000-0000-0000-0000-000000000001', 'pos-register-boundary-success')$$,
  'duplicate key'
);

DO $test$
BEGIN
  IF (SELECT count(*) FROM public.orders WHERE idempotency_key = 'pos-register-boundary-success') <> 1 THEN
    RAISE EXCEPTION 'FAIL idempotency replay created an unexpected order count';
  END IF;
  RAISE NOTICE 'PASS idempotency replay preserved one order';
END;
$test$;

ROLLBACK;
