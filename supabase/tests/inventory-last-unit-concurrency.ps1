$ErrorActionPreference = 'Stop'

$container = (& docker ps --filter 'name=^/supabase_db_7trumpets$' --format '{{.Names}}' 2>&1 | Out-String).Trim()
if ($LASTEXITCODE -ne 0) { throw "docker ps failed: $container" }
if ($container -ne 'supabase_db_7trumpets') { throw 'Local Supabase DB container is not running. Run: npx supabase start' }

function Invoke-Psql([string] $Sql) {
    $output = (& docker exec $container psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -qAt -c $Sql 2>&1 | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) { throw "psql failed: $output" }
    return $output
}

$productId = '70000000-0000-0000-0000-000000000001'
$variantId = '70000000-0000-0000-0000-000000000002'
$orderA = '70000000-0000-0000-0000-000000000003'
$orderB = '70000000-0000-0000-0000-000000000004'

$cleanupSql = @"
BEGIN;
SET LOCAL session_replication_role = replica;
DELETE FROM public.audit_logs
WHERE entity = 'inventory_reservation'
  AND entity_id IN (SELECT id FROM public.inventory_reservations WHERE variant_id = '$variantId');
DELETE FROM public.inventory_movements WHERE variant_id = '$variantId';
DELETE FROM public.inventory_reservations WHERE variant_id = '$variantId';
DELETE FROM public.order_status_history WHERE order_id IN ('$orderA', '$orderB');
DELETE FROM public.orders WHERE id IN ('$orderA', '$orderB');
DELETE FROM public.inventory WHERE variant_id = '$variantId';
DELETE FROM public.product_variants WHERE id = '$variantId';
DELETE FROM public.products WHERE id = '$productId';
COMMIT;
"@

try {
    Invoke-Psql $cleanupSql | Out-Null
    Invoke-Psql @"
BEGIN;
INSERT INTO public.products (id, slug, name) VALUES ('$productId', 'concurrency-test-product', 'Concurrency test product');
INSERT INTO public.product_variants (id, product_id, sku, price_minor)
VALUES ('$variantId', '$productId', 'CONCURRENCY-TEST-SKU', 100);
INSERT INTO public.inventory (variant_id, on_hand, reserved, safety_stock)
VALUES ('$variantId', 1, 0, 0);
INSERT INTO public.orders (
  id, order_number, idempotency_key, subtotal_minor, total_minor, customer_email,
  recipient_name, recipient_phone, address_line1, city_municipality, province, postal_code
) VALUES
  ('$orderA', 'ORD-20000101-AAAAAAAAAA', 'concurrency-test-order-a', 100, 100, 'test@example.invalid', 'Test A', '000', 'Test', 'Test', 'Test', '0000'),
  ('$orderB', 'ORD-20000101-BBBBBBBBBB', 'concurrency-test-order-b', 100, 100, 'test@example.invalid', 'Test B', '000', 'Test', 'Test', 'Test', '0000');
COMMIT;
"@ | Out-Null

    $startAt = [DateTime]::UtcNow.AddSeconds(2).ToString('o')
    $expiresAt = [DateTime]::UtcNow.AddMinutes(10).ToString('o')
    $calls = @(
        "SELECT pg_catalog.pg_sleep(greatest(0, extract(epoch FROM '$startAt'::timestamptz - pg_catalog.clock_timestamp()))); SELECT private.reserve_inventory('$orderA', '$variantId', 1, '$expiresAt', 'concurrency-test-reserve-a');",
        "SELECT pg_catalog.pg_sleep(greatest(0, extract(epoch FROM '$startAt'::timestamptz - pg_catalog.clock_timestamp()))); SELECT private.reserve_inventory('$orderB', '$variantId', 1, '$expiresAt', 'concurrency-test-reserve-b');"
    )

    $jobs = foreach ($call in $calls) {
        Start-Job -ScriptBlock {
            param($Container, $Sql)
            $text = (& docker exec $Container psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -qAt -c $Sql 2>&1 | Out-String).Trim()
            [pscustomobject]@{ ExitCode = $LASTEXITCODE; Output = $text }
        } -ArgumentList $container, $call
    }

    $results = @($jobs | Wait-Job | Receive-Job)
    $jobs | Remove-Job
    $successCount = @($results | Where-Object { $_.ExitCode -eq 0 }).Count
    if ($successCount -ne 1) {
        throw "Expected exactly one reservation call to succeed; got $successCount. $($results.Output -join ' | ')"
    }

    $state = Invoke-Psql @"
SELECT i.on_hand, i.reserved,
       count(DISTINCT r.id) FILTER (WHERE r.status = 'active'),
       count(DISTINCT m.id) FILTER (WHERE m.movement_type = 'reservation_created')
FROM public.inventory AS i
LEFT JOIN public.inventory_reservations AS r ON r.variant_id = i.variant_id
LEFT JOIN public.inventory_movements AS m ON m.variant_id = i.variant_id
WHERE i.variant_id = '$variantId'
GROUP BY i.on_hand, i.reserved;
"@
    if ($state -ne '1|1|1|1') { throw "Unexpected final state: $state (expected 1|1|1|1)" }

    $reservationId = Invoke-Psql "SELECT id FROM public.inventory_reservations WHERE variant_id = '$variantId' AND status = 'active';"
    Invoke-Psql "UPDATE public.inventory_reservations SET expires_at = pg_catalog.now() - interval '1 second' WHERE id = '$reservationId';" | Out-Null

    $terminalStartAt = [DateTime]::UtcNow.AddSeconds(2).ToString('o')
    $terminalCalls = @(
        "SELECT pg_catalog.pg_sleep(greatest(0, extract(epoch FROM '$terminalStartAt'::timestamptz - pg_catalog.clock_timestamp()))); SELECT private.transition_inventory_reservation('$reservationId', 'consumed', 'concurrency-test-consume', NULL, 'terminal race');",
        "SELECT pg_catalog.pg_sleep(greatest(0, extract(epoch FROM '$terminalStartAt'::timestamptz - pg_catalog.clock_timestamp()))); SELECT private.transition_inventory_reservation('$reservationId', 'released', 'concurrency-test-release', NULL, 'terminal race');",
        "SELECT pg_catalog.pg_sleep(greatest(0, extract(epoch FROM '$terminalStartAt'::timestamptz - pg_catalog.clock_timestamp()))); SELECT private.transition_inventory_reservation('$reservationId', 'expired', 'concurrency-test-expire', NULL, 'terminal race');"
    )

    $jobs = foreach ($call in $terminalCalls) {
        Start-Job -ScriptBlock {
            param($Container, $Sql)
            $text = (& docker exec $Container psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -qAt -c $Sql 2>&1 | Out-String).Trim()
            [pscustomobject]@{ ExitCode = $LASTEXITCODE; Output = $text }
        } -ArgumentList $container, $call
    }

    $terminalResults = @($jobs | Wait-Job | Receive-Job)
    $jobs | Remove-Job
    $terminalSuccessCount = @($terminalResults | Where-Object { $_.ExitCode -eq 0 }).Count
    if ($terminalSuccessCount -ne 1) {
        throw "Expected exactly one terminal call to succeed; got $terminalSuccessCount. $($terminalResults.Output -join ' | ')"
    }

    $terminalState = Invoke-Psql @"
SELECT (
  i.reserved = 0
  AND r.status IN ('consumed', 'released', 'expired')
  AND i.on_hand = CASE WHEN r.status = 'consumed' THEN 0 ELSE 1 END
  AND (SELECT count(*) FROM public.inventory_movements m
       WHERE m.reservation_id = r.id AND m.movement_type <> 'reservation_created') = 1
  AND (SELECT sum(m.reserved_delta) FROM public.inventory_movements m
       WHERE m.reservation_id = r.id) = 0
  AND (SELECT sum(m.on_hand_delta) FROM public.inventory_movements m
       WHERE m.reservation_id = r.id) = i.on_hand - 1
  AND EXISTS (
    SELECT 1 FROM public.inventory_movements m
    WHERE m.reservation_id = r.id AND m.movement_type <> 'reservation_created'
      AND m.on_hand_after = i.on_hand AND m.reserved_after = i.reserved
  )
  AND (SELECT count(*) FROM public.audit_logs a
       WHERE a.entity = 'inventory_reservation' AND a.entity_id = r.id) = 2
)
FROM public.inventory i
JOIN public.inventory_reservations r ON r.variant_id = i.variant_id
WHERE i.variant_id = '$variantId';
"@
    if ($terminalState -ne 't') { throw "Terminal race left inconsistent inventory or ledger state: $terminalState" }

    'PASS: one last-unit reservation and one conflicting terminal transition succeeded; inventory and ledger are consistent.'
}
finally {
    if ($jobs) { $jobs | Where-Object State -eq 'Running' | Stop-Job; $jobs | Remove-Job -Force -ErrorAction SilentlyContinue }
    Invoke-Psql $cleanupSql | Out-Null
}
