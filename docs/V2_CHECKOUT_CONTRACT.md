# V2 checkout trust-boundary repair

## Canonical supported flow

Browser selections → authenticated Next.js server action → verified claims and
getUser identity agreement → owner-scoped address and current cart → validated
persisted checkout settings → canonical shipping helper → separate backend
Supabase client → checkout RPC → locked product prices/inventory → order/payment
and reservations → successful cart cleanup → canonical order detail redirect.

The browser cannot choose customer identity, prices, shipping, or COD ceiling.
Customer login remains mandatory. Admin/RLS policies and tables are unchanged.

## RPC access

Both overloads remain for compatibility:

1. `public.checkout_order(uuid,text,jsonb,bigint,text,timestamptz,jsonb,text)`
2. `public.checkout_order(uuid,text,jsonb,bigint,text,timestamptz,jsonb,text,text)`

Previously both permitted authenticated execution. Both now explicitly revoke
EXECUTE from PUBLIC, anon, authenticated and grant it to service_role only.
The server action uses overload 2; overload 1 is its internal implementation
and supports historical backend/test callers. Neither overload is deleted.
The wrapper uses named arguments to avoid an existing overload ambiguity.

`createServiceClient` already resides in a server-only module, uses the existing
SUPABASE_SECRET_KEY convention, disables session persistence/token refresh, and
does not read cookies. It is distinct from the normal SSR authentication client.
This key bypasses RLS and has a larger blast radius: keep it out of client
bundles, props, logs and source control. Backend-only RPC inputs still trust
the protected backend's identity/shipping derivation. Removing those inputs
would require a separately reviewed RPC redesign.

## Configuration and money

Required settings are persisted JSONB rows `fulfillment` and `payment` in
public.store_settings, modified through existing Admin AAL2 settings actions.
Checkout's loader distinguishes query failure, missing rows, and malformed
configuration through CheckoutConfigurationError. All prevent checkout. No
financial defaults are substituted. Other surfaces retain their existing loader.
Amounts must be nonnegative safe integer centavos; zero is valid. The existing
shipping formula and free-shipping threshold behavior are unchanged.

cod_max_minor means maximum COD order value in integer centavos. The comparison
uses precisely the persisted total: database-calculated subtotal + canonical
backend shipping, with zero discount. Equal passes; above rejects. PostgreSQL
reads and share-locks the canonical payment setting before creation, enforcing
the ceiling even for a direct privileged caller. GCash is not subject to the COD
ceiling. Payment enablement is checked server-side and in the database.

Existing successful idempotency retries return their original order before
re-evaluating current configuration; changing settings does not invalidate
historical confirmed orders. A rejected new attempt leaves no order/payment/
reservation and can be retried with corrected input. Locks and atomic inventory
behavior remain in the installed implementation.

## Errors

Customer messages expose no database details. Configuration failure becomes
configuration_unavailable; database COD rejection becomes cod_limit_exceeded;
disabled payment becomes invalid_payment_method; other RPC failures retain
checkout_failed. No success or cart cleanup occurs on rejected creation.

## Migration and recovery

20260929010000_secure_checkout_rpc_and_cod_limit.sql is forward-only. It amends
the installed eight-argument body at an asserted insertion point, retaining
current transaction and locking rules; it replaces the current wrapper only to
disambiguate the delegation. Historical migrations are untouched. Unexpected
function text causes migration failure rather than an unchecked replacement.

Do not recover by reopening browser grants. Any corrective change must be a
reviewed forward migration; block checkout if configuration is unavailable.
Before a separately authorized production rollout, verify both overload ACLs,
valid backend checkout, COD equal/above boundaries, rollback and configuration
failures in approved staging, then perform separately authorized production
smoke testing. This document does not authorize production migration or orders.

## Verification

Local database fixtures are rolled back. No rendered checkout submission is
authorized here. Visual checkout remains paused until the security gate passes.
Final execution results are recorded in the task report; unrun checks are not
claims of success.

Local replay completed successfully for all 34 migrations. The six pgTAP suites
passed 408 assertions (including 24 checkout security assertions). Standalone
POS rollback tests also passed. Application baseline passed 144 tests; the
additional configuration/client/server-action tests passed 16. Admin source audit
passed 19. Typecheck, lint and production build passed after the final minimal
payment-configuration presentation adjustment.

Storefront QA passed 18 axe states with zero detected violations plus its
keyboard and 11-viewport checks. It also logged two React #418 hydration errors;
the runner does not treat these as a failure. This is NOT console-clean browser
evidence. No frozen shared/storefront UI was changed to repair those errors.
An existing application live-session test skipped its assertions after the
local reset removed its login fixture; the runner still reported 144 passed.
Rendered authenticated server-action success requires separately authorized
checkout UAT and is not claimed by rollback-based database tests.

The server-action harness executes the actual transpiled action with mocked
boundaries: verified identity and address scope precede the privileged call;
manipulated customer/shipping/ceiling inputs are ignored; unauthenticated and
configuration-failure paths never invoke it or clean up the cart. This is not a
claim of a rendered or live end-to-end order.
