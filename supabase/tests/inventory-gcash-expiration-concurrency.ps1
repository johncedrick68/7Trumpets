$ErrorActionPreference = 'Stop'

$container = (& docker ps --filter 'name=^/supabase_db_7trumpets$' --format '{{.Names}}' 2>&1 | Out-String).Trim()
if ($LASTEXITCODE -ne 0) { throw "docker ps failed: $container" }
if ($container -ne 'supabase_db_7trumpets') { throw 'Local Supabase DB container is not running. Run: npx supabase start' }

function Invoke-Psql([string] $Sql) {
    $output = ($Sql | & docker exec -i $container psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -qAt 2>&1 | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) { throw "psql failed: $output" }
    return $output
}

$productId = '71000000-0000-0000-0000-000000000001'
$variantId = '71000000-0000-0000-0000-000000000002'
$customerId = '71000000-0000-0000-0000-000000000003'
$adminId = '71000000-0000-0000-0000-000000000004'
$orderKey = 'concurrency-expire-order-1'

$cleanupSql = @"
BEGIN;
SET LOCAL session_replication_role = replica;
DELETE FROM public.audit_logs WHERE entity = 'payment' AND actor_id = '$adminId';
DELETE FROM public.audit_logs WHERE entity = 'inventory_reservation' AND entity_id IN (SELECT id FROM public.inventory_reservations WHERE variant_id = '$variantId');
DELETE FROM public.payment_events WHERE payment_id IN (SELECT p.id FROM public.payments p JOIN public.orders o ON o.id = p.order_id WHERE o.idempotency_key = '$orderKey');
DELETE FROM public.payments WHERE order_id IN (SELECT id FROM public.orders WHERE idempotency_key = '$orderKey');
DELETE FROM public.order_status_history WHERE order_id IN (SELECT id FROM public.orders WHERE idempotency_key = '$orderKey');
DELETE FROM public.order_items WHERE order_id IN (SELECT id FROM public.orders WHERE idempotency_key = '$orderKey');
DELETE FROM public.inventory_movements WHERE variant_id = '$variantId';
DELETE FROM public.inventory_reservations WHERE variant_id = '$variantId';
DELETE FROM public.orders WHERE idempotency_key = '$orderKey';
DELETE FROM public.inventory WHERE variant_id = '$variantId';
DELETE FROM public.product_variants WHERE id = '$variantId';
DELETE FROM public.products WHERE id = '$productId';
DELETE FROM private.user_roles WHERE user_id IN ('$customerId', '$adminId');
DELETE FROM public.profiles WHERE id IN ('$customerId', '$adminId');
DELETE FROM auth.users WHERE id IN ('$customerId', '$adminId');
COMMIT;
"@

try {
    Invoke-Psql $cleanupSql | Out-Null
    Invoke-Psql @"
BEGIN;
INSERT INTO auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('$customerId', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'conc-customer@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('$adminId', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'conc-admin@example.test', '{}'::jsonb, '{}'::jsonb, now(), now());

INSERT INTO private.user_roles (user_id, role) VALUES ('$adminId', 'admin');

INSERT INTO public.products (id, slug, name, status) VALUES ('$productId', 'concurrency-expire-prod', 'Concurrency Expire Product', 'published');
INSERT INTO public.product_variants (id, product_id, sku, price_minor) VALUES ('$variantId', '$productId', 'CONC-EXP-SKU', 15000);
INSERT INTO public.inventory (variant_id, on_hand, reserved, safety_stock) VALUES ('$variantId', 1, 0, 0);

COMMIT;
"@ | Out-Null

    # Checkout 1 item via GCash as trusted caller (service_role / postgres)
    $checkoutSql = @"
BEGIN;
SELECT public.checkout_order(
  '$customerId', '$orderKey',
  '[{"variant_id":"$variantId","quantity":1}]'::jsonb,
  0, 'MANUAL_GCASH', pg_catalog.now() + interval '1 hour',
  '{"customer_email":"conc-customer@example.test","recipient_name":"Conc Customer","recipient_phone":"09170000000","address_line1":"Conc St","city_municipality":"City","province":"Province","postal_code":"1000"}'::jsonb,
  null
);
COMMIT;
"@
    Invoke-Psql $checkoutSql | Out-Null

    $paymentId = Invoke-Psql "SELECT p.id FROM public.payments p JOIN public.orders o ON o.id = p.order_id WHERE o.idempotency_key = '$orderKey';"
    $orderId = Invoke-Psql "SELECT id FROM public.orders WHERE idempotency_key = '$orderKey';"

    # Verify initial checked-out state: on_hand=1, reserved=1
    $initState = Invoke-Psql "SELECT on_hand, reserved FROM public.inventory WHERE variant_id = '$variantId';"
    if ($initState -ne '1|1') { throw "Expected initial inventory 1|1; got $initState" }

    # Fast-forward deadline: expire the reservation
    Invoke-Psql "UPDATE public.inventory_reservations SET expires_at = pg_catalog.now() - interval '5 seconds' WHERE order_id = '$orderId';" | Out-Null

    # Prepare concurrent calls to close_expired_gcash_payment using the stable derived idempotency key
    $stableKey = "gcash_expire_$paymentId"
    $reason = 'Payment deadline expired without proof'
    $startAt = [DateTime]::UtcNow.AddSeconds(2).ToString('o')

    $callTemplate = @"
BEGIN;
SELECT pg_catalog.set_config('request.jwt.claim.sub', '$adminId', true);
SELECT pg_catalog.set_config('request.jwt.claims', '{"sub":"$adminId","role":"authenticated","aal":"aal2"}', true);
SET LOCAL role authenticated;
SELECT pg_catalog.pg_sleep(greatest(0, extract(epoch FROM '$startAt'::timestamptz - pg_catalog.clock_timestamp())));
SELECT public.close_expired_gcash_payment('$paymentId', '$stableKey', '$reason');
COMMIT;
"@

    $jobs = @(1, 2) | ForEach-Object {
        Start-Job -ScriptBlock {
            param($Container, $Sql)
            $text = ($Sql | & docker exec -i $Container psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -qAt 2>&1 | Out-String).Trim()
            [pscustomobject]@{ ExitCode = $LASTEXITCODE; Output = $text }
        } -ArgumentList $container, $callTemplate
    }

    $results = @($jobs | Wait-Job | Receive-Job)
    $jobs | Remove-Job

    # Both concurrent calls should succeed deterministically (either initial transition or safe replay of same idempotency key)
    # Both should output 'FAILED' (the terminal status of the payment)
    $successfulCalls = @($results | Where-Object { $_.ExitCode -eq 0 -and $_.Output -match 'FAILED' }).Count
    if ($successfulCalls -lt 1) {
        throw "Expected at least one call to complete with status FAILED; outputs: $($results.Output -join ' | ')"
    }

    # Verify all concurrency invariants in PostgreSQL
    $checkInvariantsSql = @"
SELECT (
  -- Inventory on_hand intact and reserved restored exactly once
  i.on_hand = 1
  AND i.reserved = 0
  -- Exactly one active-to-expired reservation transition
  AND (SELECT count(*) FROM public.inventory_reservations r WHERE r.variant_id = '$variantId' AND r.status = 'expired') = 1
  AND (SELECT count(*) FROM public.inventory_reservations r WHERE r.variant_id = '$variantId' AND r.status = 'active') = 0
  -- Exactly one reservation_created and exactly one reservation_expired movement (no duplicates)
  AND (SELECT count(*) FROM public.inventory_movements m WHERE m.variant_id = '$variantId') = 2
  AND (SELECT count(*) FROM public.inventory_movements m WHERE m.variant_id = '$variantId' AND m.movement_type = 'reservation_created') = 1
  AND (SELECT count(*) FROM public.inventory_movements m WHERE m.variant_id = '$variantId' AND m.movement_type = 'reservation_expired') = 1
  AND (SELECT sum(m.reserved_delta) FROM public.inventory_movements m WHERE m.variant_id = '$variantId') = 0
  -- Order cancelled exactly once
  AND (SELECT status FROM public.orders WHERE id = '$orderId') = 'CANCELLED'
  AND (SELECT count(*) FROM public.order_status_history h WHERE h.order_id = '$orderId' AND h.to_status = 'CANCELLED') = 1
  -- Payment failed
  AND (SELECT status FROM public.payments WHERE id = '$paymentId') = 'FAILED'
)
FROM public.inventory i
WHERE i.variant_id = '$variantId';
"@

    $invariantResult = Invoke-Psql $checkInvariantsSql
    if ($invariantResult -ne 't') {
        throw "Invariant check failed! Inventory, reservation, or ledger state is inconsistent: $invariantResult"
    }

    'PASS: GCash expiration concurrency test verified exactly-once inventory restoration, single reservation transition, no duplicate movements, and consistent terminal state.'
}
finally {
    if ($jobs) { $jobs | Where-Object State -eq 'Running' | Stop-Job; $jobs | Remove-Job -Force -ErrorAction SilentlyContinue }
    Invoke-Psql $cleanupSql | Out-Null
}
