$ErrorActionPreference = 'Stop'

$projectRef = 'eckhwcoigctkczzmkwqi'
$baseUrl = "https://$projectRef.supabase.co"
$stamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$adminEmail = "phase4-r3-admin-$stamp@example.test"
$customerEmail = "phase4-r3-customer-$stamp@example.test"
$customer2Email = "phase4-r3-customer2-$stamp@example.test"
$adminPassword = "R3!$([guid]::NewGuid().ToString('N'))aA1"
$customerPassword = "R3!$([guid]::NewGuid().ToString('N'))aA1"
$customer2Password = "R3!$([guid]::NewGuid().ToString('N'))aA1"
$adminId = $null
$customerId = $null
$customer2Id = $null
$aal2Token = $null
$categoryId = $null
$productId = $null
$variantId = $null
$imageId = $null
$lastVariantId = $null

function Assert-True([bool] $Condition, [string] $Message) {
    if (-not $Condition) { throw $Message }
}

function Get-ManagementToken {
    Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public static class R3Cred{[StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]public struct C{public uint Flags,Type;public string TargetName,Comment;public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;public uint CredentialBlobSize;public IntPtr CredentialBlob;public uint Persist,AttributeCount;public IntPtr Attributes;public string TargetAlias,UserName;}[DllImport("advapi32.dll",EntryPoint="CredReadW",CharSet=CharSet.Unicode)]public static extern bool Read(string t,uint y,uint f,out IntPtr p);[DllImport("advapi32.dll",EntryPoint="CredFree")]public static extern void Free(IntPtr p);}'
    $pointer = [IntPtr]::Zero
    if (-not [R3Cred]::Read('Supabase CLI:supabase', 1, 0, [ref] $pointer)) { throw 'Supabase CLI credential unavailable.' }
    try {
        $credential = [Runtime.InteropServices.Marshal]::PtrToStructure($pointer, [type][R3Cred+C])
        $bytes = New-Object byte[] $credential.CredentialBlobSize
        [Runtime.InteropServices.Marshal]::Copy($credential.CredentialBlob, $bytes, 0, $bytes.Length)
        return [Text.Encoding]::UTF8.GetString($bytes)
    } finally {
        [R3Cred]::Free($pointer)
    }
}

function Invoke-ManagementQuery([string] $Query) {
    $body = @{ query = $Query; parameters = @() } | ConvertTo-Json -Compress
    return Invoke-RestMethod -Method Post -Uri "https://api.supabase.com/v1/projects/$projectRef/database/query" `
        -Headers @{ Authorization = "Bearer $script:managementToken" } -ContentType 'application/json' -Body $body
}

function Invoke-Auth([string] $Method, [string] $Path, [object] $Body, [string] $Bearer, [string] $ApiKey) {
    $headers = @{ apikey = $ApiKey }
    if ($Bearer) { $headers.Authorization = "Bearer $Bearer" }
    $arguments = @{ Method = $Method; Uri = "$baseUrl/auth/v1/$Path"; Headers = $headers; ContentType = 'application/json' }
    if ($null -ne $Body) { $arguments.Body = $Body | ConvertTo-Json -Compress }
    try {
        return Invoke-RestMethod @arguments
    } catch {
        $status = if ($_.Exception.Response) { [int] $_.Exception.Response.StatusCode } else { 0 }
        $message = $_.ErrorDetails.Message
        throw "Auth API $Path failed ($status): $message"
    }
}

function Invoke-Rpc([string] $Name, [object] $Body, [string] $Bearer, [string] $ApiKey) {
    try {
        $result = Invoke-RestMethod -Method Post -Uri "$baseUrl/rest/v1/rpc/$Name" `
            -Headers @{ apikey = $ApiKey; Authorization = "Bearer $Bearer" } `
            -ContentType 'application/json' -Body ($Body | ConvertTo-Json -Compress)
        return [pscustomobject]@{ Success = $true; Status = 200; Body = $result }
    } catch {
        $response = $_.Exception.Response
        $status = if ($response) { [int] $response.StatusCode } else { 0 }
        $text = ''
        if ($response) {
            $reader = New-Object IO.StreamReader($response.GetResponseStream())
            try { $text = $reader.ReadToEnd() } finally { $reader.Dispose() }
        }
        if (-not $text -and $_.ErrorDetails.Message) { $text = $_.ErrorDetails.Message }
        return [pscustomobject]@{ Success = $false; Status = $status; Body = $text }
    }
}

function ConvertFrom-Base32([string] $Value) {
    $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
    $bits = 0
    $buffer = 0
    $output = New-Object System.Collections.Generic.List[byte]
    foreach ($character in $Value.TrimEnd('=').ToUpperInvariant().ToCharArray()) {
        $index = $alphabet.IndexOf($character)
        if ($index -lt 0) { throw 'Invalid base32 input.' }
        $buffer = ($buffer -shl 5) -bor $index
        $bits += 5
        if ($bits -ge 8) {
            $bits -= 8
            $output.Add([byte](($buffer -shr $bits) -band 0xff))
            $buffer = $buffer -band ((1 -shl $bits) - 1)
        }
    }
    return $output.ToArray()
}

function Get-Totp([string] $Secret) {
    [uint64] $counter = [Math]::Floor([DateTimeOffset]::UtcNow.ToUnixTimeSeconds() / 30)
    $message = New-Object byte[] 8
    for ($i = 7; $i -ge 0; $i--) { $message[$i] = [byte]($counter -band 0xff); $counter = $counter -shr 8 }
    $hmac = New-Object Security.Cryptography.HMACSHA1(,(ConvertFrom-Base32 $Secret))
    try { $hash = $hmac.ComputeHash($message) } finally { $hmac.Dispose() }
    $offset = $hash[$hash.Length - 1] -band 0x0f
    $code = ((($hash[$offset] -band 0x7f) -shl 24) -bor (($hash[$offset + 1] -band 0xff) -shl 16) -bor (($hash[$offset + 2] -band 0xff) -shl 8) -bor ($hash[$offset + 3] -band 0xff)) % 1000000
    return $code.ToString('000000')
}

function Get-JwtAal([string] $Token) {
    $part = $Token.Split('.')[1].Replace('-', '+').Replace('_', '/')
    $part += '=' * ((4 - $part.Length % 4) % 4)
    return ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($part)) | ConvertFrom-Json).aal
}

function Invoke-ConcurrentRpcs([object[]] $Calls) {
    $startAt = [DateTime]::UtcNow.AddSeconds(3)
    $jobs = foreach ($call in $Calls) {
        Start-Job -ScriptBlock {
            param($Call, $StartAt)
            while ([DateTime]::UtcNow -lt $StartAt) { Start-Sleep -Milliseconds 20 }
            try {
                [void](Invoke-RestMethod -Method Post -Uri $Call.Uri -Headers $Call.Headers -ContentType 'application/json' -Body $Call.Body)
                [pscustomobject]@{ Success = $true; Status = 200; Error = '' }
            } catch {
                [pscustomobject]@{ Success = $false; Status = if ($_.Exception.Response) { [int] $_.Exception.Response.StatusCode } else { 0 }; Error = $_.ErrorDetails.Message }
            }
        } -ArgumentList $call, $startAt
    }
    try { return @($jobs | Wait-Job | Receive-Job) } finally { $jobs | Remove-Job -Force }
}

$managementToken = Get-ManagementToken
$keyJson = (& npx supabase projects api-keys --project-ref $projectRef --reveal --output json 2>$null | Out-String)
$keys = $keyJson | ConvertFrom-Json
$publishableKey = ($keys | Where-Object type -eq 'publishable' | Select-Object -First 1).api_key
$serviceJwt = ($keys | Where-Object { $_.name -eq 'service_role' -and $_.type -eq 'legacy' } | Select-Object -First 1).api_key
Assert-True ([bool] $publishableKey -and [bool] $serviceJwt) 'Required development API keys unavailable.'

try {
    $admin = Invoke-Auth 'POST' 'admin/users' @{ email = $adminEmail; password = $adminPassword; email_confirm = $true } $serviceJwt $serviceJwt
    $customer = Invoke-Auth 'POST' 'admin/users' @{ email = $customerEmail; password = $customerPassword; email_confirm = $true } $serviceJwt $serviceJwt
    $customer2 = Invoke-Auth 'POST' 'admin/users' @{ email = $customer2Email; password = $customer2Password; email_confirm = $true } $serviceJwt $serviceJwt
    $adminId = [guid]::Parse($admin.id).ToString()
    $customerId = [guid]::Parse($customer.id).ToString()
    $customer2Id = [guid]::Parse($customer2.id).ToString()
    [void](Invoke-ManagementQuery "insert into private.user_roles (user_id, role) values ('$adminId'::uuid, 'admin');")
    "HOSTED_SYNTHETIC_ADMIN_UUID=$adminId"

    $adminAal1 = Invoke-Auth 'POST' 'token?grant_type=password' @{ email = $adminEmail; password = $adminPassword } $null $publishableKey
    $customerAal1 = Invoke-Auth 'POST' 'token?grant_type=password' @{ email = $customerEmail; password = $customerPassword } $null $publishableKey
    $customer2Aal1 = Invoke-Auth 'POST' 'token?grant_type=password' @{ email = $customer2Email; password = $customer2Password } $null $publishableKey
    Assert-True ((Get-JwtAal $adminAal1.access_token) -eq 'aal1') 'Admin did not sign in at AAL1.'
    'MFA_AAL1=PASS'

    $deniedCalls = @(
        @{ Name = 'admin_save_category'; Body = @{ p_id = $null; p_name = 'Denied'; p_slug = "r3-denied-$stamp"; p_description = $null; p_parent_id = $null; p_position = 0; p_archived = $false } },
        @{ Name = 'admin_save_product'; Body = @{ p_id = $null; p_category_id = $null; p_name = 'Denied'; p_slug = "r3-denied-product-$stamp"; p_description = $null; p_status = 'draft' } },
        @{ Name = 'admin_save_variant'; Body = @{ p_id = $null; p_product_id = [guid]::NewGuid(); p_sku = "DENIED-$stamp"; p_name = 'Denied'; p_price_minor = 100; p_compare_at_price_minor = $null; p_status = 'active' } },
        @{ Name = 'admin_adjust_inventory'; Body = @{ p_variant_id = [guid]::NewGuid(); p_delta = 1; p_type = 'restock'; p_reason = 'Denied'; p_idempotency_key = "r3-denied-$stamp" } },
        @{ Name = 'admin_save_product_option'; Body = @{ p_product_id = [guid]::NewGuid(); p_name = 'Denied'; p_id = $null; p_position = 0 } },
        @{ Name = 'admin_save_product_image'; Body = @{ p_product_id = [guid]::NewGuid(); p_storage_path = 'denied.webp'; p_alt_text = 'Denied'; p_variant_id = $null; p_position = 0 } }
    )
    foreach ($call in $deniedCalls) {
        $denied = Invoke-Rpc $call.Name $call.Body $adminAal1.access_token $publishableKey
        Assert-True (-not $denied.Success -and $denied.Body -match 'AAL2 required') "AAL1 unexpectedly reached $($call.Name)."
    }
    'AAL1_ADMIN_MUTATION_NEGATIVES=PASS'

    $serviceDenied = Invoke-Rpc 'admin_save_category' $deniedCalls[0].Body $serviceJwt $serviceJwt
    Assert-True (-not $serviceDenied.Success -and $serviceDenied.Body -match 'permission denied') 'service_role retained effective Phase 4 execute.'
    'SERVICE_ROLE_EXECUTE_NEGATIVE=PASS'

    $enrollment = Invoke-Auth 'POST' 'factors' @{ factor_type = 'totp'; friendly_name = "phase4-r3-$stamp"; issuer = '7Trumpets Development' } $adminAal1.access_token $publishableKey
    Assert-True ([bool] $enrollment.id -and [bool] $enrollment.totp.secret) 'TOTP enrollment failed.'
    'MFA_ENROLLMENT=PASS'

    $challenge = Invoke-Auth 'POST' "factors/$($enrollment.id)/challenge" @{} $adminAal1.access_token $publishableKey
    $validCode = Get-Totp $enrollment.totp.secret
    $invalidCode = (([int] $validCode + 1) % 1000000).ToString('000000')
    try {
        [void](Invoke-Auth 'POST' "factors/$($enrollment.id)/verify" @{ challenge_id = $challenge.id; code = $invalidCode } $adminAal1.access_token $publishableKey)
        throw 'Invalid TOTP code was accepted.'
    } catch {
        if ($_.Exception.Message -eq 'Invalid TOTP code was accepted.') { throw }
    }
    'MFA_INVALID_VERIFY=DENIED'

    $challenge = Invoke-Auth 'POST' "factors/$($enrollment.id)/challenge" @{} $adminAal1.access_token $publishableKey
    $verified = Invoke-Auth 'POST' "factors/$($enrollment.id)/verify" @{ challenge_id = $challenge.id; code = (Get-Totp $enrollment.totp.secret) } $adminAal1.access_token $publishableKey
    $aal2Token = $verified.access_token
    Assert-True ((Get-JwtAal $aal2Token) -eq 'aal2') 'Verified session is not AAL2.'
    'MFA_AAL2=PASS'

    $customerEnrollment = Invoke-Auth 'POST' 'factors' @{ factor_type = 'totp'; friendly_name = "phase4-r3-customer-$stamp"; issuer = '7Trumpets Development' } $customerAal1.access_token $publishableKey
    $customerChallenge = Invoke-Auth 'POST' "factors/$($customerEnrollment.id)/challenge" @{} $customerAal1.access_token $publishableKey
    $customerVerified = Invoke-Auth 'POST' "factors/$($customerEnrollment.id)/verify" @{ challenge_id = $customerChallenge.id; code = (Get-Totp $customerEnrollment.totp.secret) } $customerAal1.access_token $publishableKey
    Assert-True ((Get-JwtAal $customerVerified.access_token) -eq 'aal2') 'Synthetic customer session is not AAL2.'
    $customerDenied = Invoke-Rpc 'admin_save_category' $deniedCalls[0].Body $customerVerified.access_token $publishableKey
    Assert-True (-not $customerDenied.Success -and $customerDenied.Body -match 'admin role required') 'AAL2 customer admin RPC was not denied by role authorization.'
    'CUSTOMER_ADMIN_RPC_NEGATIVE=PASS'

    $categoryId = (Invoke-Rpc 'admin_save_category' @{ p_id = $null; p_name = "R3 Category $stamp"; p_slug = "r3-category-$stamp"; p_description = 'Synthetic R3 fixture'; p_parent_id = $null; p_position = 0; p_archived = $false } $aal2Token $publishableKey).Body
    $productId = (Invoke-Rpc 'admin_save_product' @{ p_id = $null; p_category_id = $categoryId; p_name = "R3 Product $stamp"; p_slug = "r3-product-$stamp"; p_description = 'Synthetic R3 fixture'; p_status = 'published' } $aal2Token $publishableKey).Body
    $variantId = (Invoke-Rpc 'admin_save_variant' @{ p_id = $null; p_product_id = $productId; p_sku = "R3-M-BLUE-$stamp"; p_name = 'M / Blue'; p_price_minor = 70000; p_compare_at_price_minor = $null; p_status = 'active' } $aal2Token $publishableKey).Body
    $sizeOptionId = (Invoke-Rpc 'admin_save_product_option' @{ p_product_id = $productId; p_name = 'Size'; p_id = $null; p_position = 0 } $aal2Token $publishableKey).Body
    $sizeValueId = (Invoke-Rpc 'admin_save_option_value' @{ p_product_id = $productId; p_option_id = $sizeOptionId; p_value = 'M'; p_id = $null; p_position = 1 } $aal2Token $publishableKey).Body
    $colorOptionId = (Invoke-Rpc 'admin_save_product_option' @{ p_product_id = $productId; p_name = 'Color'; p_id = $null; p_position = 1 } $aal2Token $publishableKey).Body
    $colorValueId = (Invoke-Rpc 'admin_save_option_value' @{ p_product_id = $productId; p_option_id = $colorOptionId; p_value = 'Blue'; p_id = $null; p_position = 1 } $aal2Token $publishableKey).Body
    Assert-True (Invoke-Rpc 'admin_set_variant_option_value' @{ p_product_id = $productId; p_variant_id = $variantId; p_option_id = $sizeOptionId; p_option_value_id = $sizeValueId } $aal2Token $publishableKey).Success 'Size assignment failed.'
    Assert-True (Invoke-Rpc 'admin_set_variant_option_value' @{ p_product_id = $productId; p_variant_id = $variantId; p_option_id = $colorOptionId; p_option_value_id = $colorValueId } $aal2Token $publishableKey).Success 'Color assignment failed.'
    Assert-True (Invoke-Rpc 'admin_adjust_inventory' @{ p_variant_id = $variantId; p_delta = 5; p_type = 'restock'; p_reason = 'R3 hosted verification'; p_idempotency_key = "r3-restock-$stamp" } $aal2Token $publishableKey).Success 'Inventory adjustment failed.'
    $imageId = (Invoke-Rpc 'admin_save_product_image' @{ p_product_id = $productId; p_storage_path = "r3/$stamp.webp"; p_alt_text = 'R3 synthetic image'; p_variant_id = $variantId; p_position = 1 } $aal2Token $publishableKey).Body

    $evidence = Invoke-ManagementQuery "select (select count(*) from public.audit_logs where actor_id='$adminId'::uuid and action in ('category.created','product.created','variant.created','product_option.created','option_value.created','variant_option.assigned','inventory.restock','product_image.added')) audit_count,(select count(*) from public.inventory_movements where variant_id='$variantId'::uuid and actor_id='$adminId'::uuid and movement_type='restock') movement_count,(select count(*) from public.product_images where id='$imageId'::uuid and product_id='$productId'::uuid and variant_id='$variantId'::uuid and position=1) image_count;"
    Assert-True ($evidence[0].audit_count -ge 9 -and $evidence[0].movement_count -eq 1 -and $evidence[0].image_count -eq 1) 'Hosted persistence/audit evidence is incomplete.'
    'AAL2_ADMIN_MUTATION_POSITIVES=PASS'
    "AAL2_AUDIT_ROWS=$($evidence[0].audit_count);MOVEMENTS=$($evidence[0].movement_count);IMAGES=$($evidence[0].image_count)"

    $checkoutBody = @{
        p_customer_id = $customerId; p_idempotency_key = "r3-admin-checkout-$stamp"
        p_lines = @(@{ variant_id = $variantId; quantity = 5 }); p_shipping_minor = 0
        p_payment_method = 'COD'; p_gcash_expires_at = $null
        p_delivery = @{ customer_email = $customerEmail; recipient_name = 'R3 Customer'; recipient_phone = '09170000001'; address_line1 = 'R3 Street'; city_municipality = 'City'; province = 'Province'; postal_code = '1000'; country_code = 'PH' }
        p_customer_note = $null
    } | ConvertTo-Json -Compress -Depth 5
    $adjustBody = @{ p_variant_id = $variantId; p_delta = -1; p_type = 'adjustment'; p_reason = 'R3 concurrent adjustment'; p_idempotency_key = "r3-race-adjust-$stamp" } | ConvertTo-Json -Compress
    $race = Invoke-ConcurrentRpcs @(
        @{ Uri = "$baseUrl/rest/v1/rpc/checkout_order"; Headers = @{ apikey = $serviceJwt; Authorization = "Bearer $serviceJwt" }; Body = $checkoutBody },
        @{ Uri = "$baseUrl/rest/v1/rpc/admin_adjust_inventory"; Headers = @{ apikey = $publishableKey; Authorization = "Bearer $aal2Token" }; Body = $adjustBody }
    )
    Assert-True (@($race | Where-Object Success).Count -eq 1) 'Hosted admin-adjust/checkout race did not produce exactly one winner.'
    $raceEvidence = Invoke-ManagementQuery "select i.on_hand,i.reserved,i.safety_stock,(i.reserved+i.safety_stock<=i.on_hand) invariant,(select count(*) from public.inventory_movements where variant_id='$variantId'::uuid) movements,(select id from public.orders where idempotency_key='r3-admin-checkout-$stamp') order_id from public.inventory i where i.variant_id='$variantId'::uuid;"
    Assert-True ($raceEvidence[0].invariant -and (($raceEvidence[0].on_hand -eq 4 -and $raceEvidence[0].reserved -eq 0 -and $raceEvidence[0].movements -eq 2 -and -not $raceEvidence[0].order_id) -or ($raceEvidence[0].on_hand -eq 0 -and $raceEvidence[0].reserved -eq 0 -and $raceEvidence[0].movements -eq 3 -and $raceEvidence[0].order_id))) 'Hosted admin-adjust/checkout state or ledger is inconsistent.'
    'HOSTED_ADMIN_ADJUST_CHECKOUT_CONCURRENCY=PASS'
    if ($raceEvidence[0].order_id) {
        Assert-True (Invoke-Rpc 'admin_transition_order' @{ p_order_id = $raceEvidence[0].order_id; p_to_status = 'CANCELLED'; p_note = 'R3 synthetic cleanup'; p_source = 'verification'; p_idempotency_key = "r3-race-cancel-$stamp"; p_metadata = @{} } $aal2Token $publishableKey).Success 'Race winner order cleanup failed.'
    }

    $lastVariantId = (Invoke-Rpc 'admin_save_variant' @{ p_id = $null; p_product_id = $productId; p_sku = "R3-LAST-$stamp"; p_name = 'Last unit'; p_price_minor = 10000; p_compare_at_price_minor = $null; p_status = 'active' } $aal2Token $publishableKey).Body
    Assert-True (Invoke-Rpc 'admin_adjust_inventory' @{ p_variant_id = $lastVariantId; p_delta = 1; p_type = 'restock'; p_reason = 'R3 last unit'; p_idempotency_key = "r3-last-stock-$stamp" } $aal2Token $publishableKey).Success 'Last-unit setup failed.'
    $delivery1 = @{ customer_email = $customerEmail; recipient_name = 'R3 Customer 1'; recipient_phone = '09170000001'; address_line1 = 'R3 Street'; city_municipality = 'City'; province = 'Province'; postal_code = '1000'; country_code = 'PH' }
    $delivery2 = @{ customer_email = $customer2Email; recipient_name = 'R3 Customer 2'; recipient_phone = '09170000002'; address_line1 = 'R3 Street'; city_municipality = 'City'; province = 'Province'; postal_code = '1000'; country_code = 'PH' }
    $lastBody1 = @{ p_customer_id = $customerId; p_idempotency_key = "r3-last-1-$stamp"; p_lines = @(@{ variant_id = $lastVariantId; quantity = 1 }); p_shipping_minor = 0; p_payment_method = 'COD'; p_gcash_expires_at = $null; p_delivery = $delivery1; p_customer_note = $null } | ConvertTo-Json -Compress -Depth 5
    $lastBody2 = @{ p_customer_id = $customer2Id; p_idempotency_key = "r3-last-2-$stamp"; p_lines = @(@{ variant_id = $lastVariantId; quantity = 1 }); p_shipping_minor = 0; p_payment_method = 'COD'; p_gcash_expires_at = $null; p_delivery = $delivery2; p_customer_note = $null } | ConvertTo-Json -Compress -Depth 5
    $lastRace = Invoke-ConcurrentRpcs @(
        @{ Uri = "$baseUrl/rest/v1/rpc/checkout_order"; Headers = @{ apikey = $serviceJwt; Authorization = "Bearer $serviceJwt" }; Body = $lastBody1 },
        @{ Uri = "$baseUrl/rest/v1/rpc/checkout_order"; Headers = @{ apikey = $serviceJwt; Authorization = "Bearer $serviceJwt" }; Body = $lastBody2 }
    )
    Assert-True (@($lastRace | Where-Object Success).Count -eq 1) "Hosted last-unit race did not produce exactly one winner: $($lastRace | ConvertTo-Json -Compress)"
    $lastEvidence = Invoke-ManagementQuery "select i.on_hand,i.reserved,(i.reserved+i.safety_stock<=i.on_hand) invariant,(select count(*) from public.orders where idempotency_key in ('r3-last-1-$stamp','r3-last-2-$stamp')) orders,(select id from public.orders where idempotency_key in ('r3-last-1-$stamp','r3-last-2-$stamp') limit 1) order_id from public.inventory i where i.variant_id='$lastVariantId'::uuid;"
    Assert-True ($lastEvidence[0].on_hand -eq 0 -and $lastEvidence[0].reserved -eq 0 -and $lastEvidence[0].invariant -and $lastEvidence[0].orders -eq 1) 'Hosted last-unit race oversold or produced inconsistent state.'
    'HOSTED_LAST_UNIT_CONCURRENCY=PASS'
    Assert-True (Invoke-Rpc 'admin_transition_order' @{ p_order_id = $lastEvidence[0].order_id; p_to_status = 'CANCELLED'; p_note = 'R3 synthetic cleanup'; p_source = 'verification'; p_idempotency_key = "r3-last-cancel-$stamp"; p_metadata = @{} } $aal2Token $publishableKey).Success 'Last-unit winner order cleanup failed.'
}
finally {
    if ($aal2Token -and $imageId) {
        [void](Invoke-Rpc 'admin_delete_product_image' @{ p_image_id = $imageId } $aal2Token $publishableKey)
    }
    if ($aal2Token -and $variantId) {
        [void](Invoke-Rpc 'admin_save_variant' @{ p_id = $variantId; p_product_id = $productId; p_sku = "R3-M-BLUE-$stamp"; p_name = 'M / Blue'; p_price_minor = 70000; p_compare_at_price_minor = $null; p_status = 'archived' } $aal2Token $publishableKey)
    }
    if ($aal2Token -and $lastVariantId) {
        [void](Invoke-Rpc 'admin_save_variant' @{ p_id = $lastVariantId; p_product_id = $productId; p_sku = "R3-LAST-$stamp"; p_name = 'Last unit'; p_price_minor = 10000; p_compare_at_price_minor = $null; p_status = 'archived' } $aal2Token $publishableKey)
    }
    if ($aal2Token -and $productId) {
        [void](Invoke-Rpc 'admin_save_product' @{ p_id = $productId; p_category_id = $categoryId; p_name = "R3 Product $stamp"; p_slug = "r3-product-$stamp"; p_description = 'Synthetic R3 fixture retained for immutable movement history'; p_status = 'archived' } $aal2Token $publishableKey)
    }
    if ($aal2Token -and $categoryId) {
        [void](Invoke-Rpc 'admin_save_category' @{ p_id = $categoryId; p_name = "R3 Category $stamp"; p_slug = "r3-category-$stamp"; p_description = 'Synthetic R3 fixture retained for immutable movement history'; p_parent_id = $null; p_position = 0; p_archived = $true } $aal2Token $publishableKey)
    }
    if ($adminId) { [void](Invoke-Auth 'DELETE' "admin/users/$adminId" $null $serviceJwt $serviceJwt) }
    if ($customerId) { [void](Invoke-Auth 'DELETE' "admin/users/$customerId" $null $serviceJwt $serviceJwt) }
    if ($customer2Id) { [void](Invoke-Auth 'DELETE' "admin/users/$customer2Id" $null $serviceJwt $serviceJwt) }
    'SYNTHETIC_AUTH_AND_FACTOR_CLEANUP=PASS'
    if ($variantId) { 'SYNTHETIC_CATALOG_RETAINED_ARCHIVED_FOR_IMMUTABLE_INVENTORY_HISTORY=YES' }
}
