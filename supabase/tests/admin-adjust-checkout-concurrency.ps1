$ErrorActionPreference = 'Stop'

$container = (& docker ps --filter 'name=^/supabase_db_7trumpets$' --format '{{.Names}}' 2>&1 | Out-String).Trim()
if ($LASTEXITCODE -ne 0) { throw "docker ps failed: $container" }
if ($container -ne 'supabase_db_7trumpets') { throw 'Local Supabase DB container is not running.' }

function Invoke-Psql([string] $Sql) {
    $output = ($Sql | & docker exec -i $container psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -qAt 2>&1 | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) { throw "psql failed: $output" }
    return $output
}

$adminId = '76000000-0000-0000-0000-000000000001'
$customerId = '76000000-0000-0000-0000-000000000002'
$productId = '76000000-0000-0000-0000-000000000003'
$variantId = '76000000-0000-0000-0000-000000000004'
$jobs = @()

$cleanupSql = @"
BEGIN;
SET LOCAL session_replication_role = replica;
DELETE FROM public.audit_logs WHERE entity_id IN (
  SELECT id FROM public.inventory_reservations WHERE variant_id = '$variantId'
) OR (entity = 'inventory_movement' AND new_values ->> 'variant_id' = '$variantId');
DELETE FROM public.inventory_movements WHERE variant_id = '$variantId';
DELETE FROM public.inventory_reservations WHERE variant_id = '$variantId';
DELETE FROM public.orders WHERE idempotency_key = 'admin-checkout-race';
DELETE FROM public.inventory WHERE variant_id = '$variantId';
DELETE FROM public.product_variants WHERE id = '$variantId';
DELETE FROM public.products WHERE id = '$productId';
DELETE FROM private.user_roles WHERE user_id IN ('$adminId', '$customerId');
DELETE FROM public.profiles WHERE id IN ('$adminId', '$customerId');
DELETE FROM auth.users WHERE id IN ('$adminId', '$customerId');
COMMIT;
"@

try {
    Invoke-Psql $cleanupSql | Out-Null
    Invoke-Psql @"
INSERT INTO auth.users (
  id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('$adminId', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'race-admin@example.test', '{}', '{}', now(), now()),
  ('$customerId', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'race-customer@example.test', '{}', '{}', now(), now());
INSERT INTO private.user_roles (user_id, role) VALUES ('$adminId', 'admin');
INSERT INTO public.products (id, slug, name, status)
VALUES ('$productId', 'admin-checkout-race', 'Admin checkout race', 'published');
INSERT INTO public.product_variants (id, product_id, sku, price_minor)
VALUES ('$variantId', '$productId', 'ADMIN-CHECKOUT-RACE', 10000);
INSERT INTO public.inventory (variant_id, on_hand, reserved, safety_stock)
VALUES ('$variantId', 5, 0, 1);
"@ | Out-Null

    $startAt = [DateTime]::UtcNow.AddSeconds(2).ToString('o')
    $expiresAt = [DateTime]::UtcNow.AddMinutes(10).ToString('o')
    $checkout = @"
SELECT pg_catalog.pg_sleep(greatest(0, extract(epoch FROM '$startAt'::timestamptz - pg_catalog.clock_timestamp())));
SELECT public.checkout_order(
  '$customerId', 'admin-checkout-race', '[{"variant_id":"$variantId","quantity":4}]'::jsonb,
  0, 'COD', NULL, '{"customer_email":"race-customer@example.test","recipient_name":"Race Customer","recipient_phone":"1","address_line1":"Street","city_municipality":"City","province":"Province","postal_code":"1000"}'::jsonb, NULL
);
"@
    $adjust = @"
SELECT pg_catalog.pg_sleep(greatest(0, extract(epoch FROM '$startAt'::timestamptz - pg_catalog.clock_timestamp())));
SELECT pg_catalog.set_config('request.jwt.claim.sub', '$adminId', false);
SELECT pg_catalog.set_config('request.jwt.claims', '{"sub":"$adminId","role":"authenticated","aal":"aal2"}', false);
SET ROLE authenticated;
SELECT public.admin_adjust_inventory('$variantId', -1, 'adjustment', 'Concurrent correction', 'admin-checkout-race-adjust');
"@

    $jobs = foreach ($call in @($checkout, $adjust)) {
        Start-Job -ScriptBlock {
            param($Container, $Sql)
            $text = ($Sql | & docker exec -i $Container psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -qAt 2>&1 | Out-String).Trim()
            [pscustomobject]@{ ExitCode = $LASTEXITCODE; Output = $text }
        } -ArgumentList $container, $call
    }

    $results = @($jobs | Wait-Job | Receive-Job)
    $jobs | Remove-Job
    $jobs = @()
    $successCount = @($results | Where-Object ExitCode -eq 0).Count
    if ($successCount -ne 1) { throw "Expected exactly one operation to succeed; got $successCount. $($results.Output -join ' | ')" }

    $state = Invoke-Psql @"
SELECT i.on_hand, i.reserved, i.safety_stock,
       i.reserved + i.safety_stock <= i.on_hand,
       (SELECT count(*) FROM public.inventory_movements m WHERE m.variant_id = i.variant_id),
       (SELECT count(*) FROM public.audit_logs a
        WHERE (a.entity = 'inventory_reservation' AND a.entity_id IN
                 (SELECT r.id FROM public.inventory_reservations r WHERE r.variant_id = i.variant_id))
           OR (a.entity = 'inventory_movement' AND a.new_values ->> 'variant_id' = i.variant_id::text))
FROM public.inventory i WHERE i.variant_id = '$variantId';
"@
    if ($state -notin @('5|4|1|t|1|1', '4|0|1|t|1|1')) {
        throw "Race left inconsistent stock or ledgers: $state"
    }

    "PASS: exactly one concurrent checkout/admin adjustment committed; final state $state."
}
finally {
    if ($jobs) { $jobs | Where-Object State -eq 'Running' | Stop-Job; $jobs | Remove-Job -Force -ErrorAction SilentlyContinue }
    Invoke-Psql $cleanupSql | Out-Null
}
