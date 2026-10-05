$ErrorActionPreference = 'Stop'

$container = (& docker ps --filter 'name=^/supabase_db_7trumpets$' --format '{{.Names}}' 2>&1 | Out-String).Trim()
if ($LASTEXITCODE -ne 0) { throw "docker ps failed: $container" }
if ($container -ne 'supabase_db_7trumpets') { throw 'Local Supabase DB container is not running. Run: npx supabase start' }

function Invoke-Psql([string] $Sql) {
    $output = (& docker exec $container psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -qAt -c $Sql 2>&1 | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) { throw "psql failed: $output" }
    return $output
}

$userA = '90000000-0000-0000-0000-000000000001'
$userB = '90000000-0000-0000-0000-000000000002'
$jobs = @()

$cleanupSql = @"
BEGIN;
SET LOCAL session_replication_role = replica;
DELETE FROM private.user_roles WHERE user_id IN ('$userA', '$userB');
DELETE FROM public.profiles WHERE id IN ('$userA', '$userB');
DELETE FROM auth.users WHERE id IN ('$userA', '$userB');
COMMIT;
"@

try {
    Invoke-Psql $cleanupSql | Out-Null
    Invoke-Psql @"
INSERT INTO auth.users (
  id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) VALUES
  ('$userA', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'race-a@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('$userB', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'race-b@example.test', '{}'::jsonb, '{}'::jsonb, now(), now());
INSERT INTO private.user_roles (user_id, role)
VALUES ('$userA', 'super_admin'), ('$userB', 'super_admin');
"@ | Out-Null

    $startAt = [DateTime]::UtcNow.AddSeconds(2).ToString('o')
    $calls = @(
        "SELECT pg_catalog.pg_sleep(greatest(0, extract(epoch FROM '$startAt'::timestamptz - pg_catalog.clock_timestamp()))); DELETE FROM auth.users WHERE id = '$userA';",
        "SELECT pg_catalog.pg_sleep(greatest(0, extract(epoch FROM '$startAt'::timestamptz - pg_catalog.clock_timestamp()))); DELETE FROM auth.users WHERE id = '$userB';"
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
    $jobs = @()
    $successCount = @($results | Where-Object { $_.ExitCode -eq 0 }).Count
    $blocked = @($results | Where-Object { $_.ExitCode -ne 0 -and $_.Output -match 'LAST_SUPER_ADMIN_REQUIRED' }).Count
    if ($successCount -ne 1 -or $blocked -ne 1) {
        throw "Expected one delete and one guard failure; successes=$successCount blocked=$blocked. $($results.Output -join ' | ')"
    }

    $state = Invoke-Psql @"
SELECT
  (SELECT count(*) FROM private.user_roles WHERE user_id IN ('$userA', '$userB') AND role = 'super_admin'),
  (SELECT count(*) FROM auth.users WHERE id IN ('$userA', '$userB')),
  (SELECT count(*) FROM public.profiles WHERE id IN ('$userA', '$userB')),
  (SELECT count(*) FROM private.user_roles WHERE user_id IN ('$userA', '$userB')),
  NOT EXISTS (
    SELECT 1 FROM private.user_roles r
    WHERE r.user_id IN ('$userA', '$userB')
      AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = r.user_id)
  ),
  NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id IN ('$userA', '$userB')
      AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id)
  );
"@
    if ($state -ne '1|1|1|2|t|t') { throw "Concurrent deletion left an invalid state: $state" }

    'PASS: exactly one concurrent super_admin Auth deletion succeeded; one identity, profile, and final super_admin remain.'
}
finally {
    if ($jobs) { $jobs | Where-Object State -eq 'Running' | Stop-Job; $jobs | Remove-Job -Force -ErrorAction SilentlyContinue }
    Invoke-Psql $cleanupSql | Out-Null
}
