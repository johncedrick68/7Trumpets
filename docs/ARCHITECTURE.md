# 1968 Clothing Architecture

This document describes the application as it operates today. It is a guide to
preserving verified behavior, not a proposal for a replacement platform.

The non-negotiable business rules are maintained in
[DOMAIN_INVARIANTS.md](./DOMAIN_INVARIANTS.md). Environment separation and
release gates are defined in [ENVIRONMENTS.md](./ENVIRONMENTS.md) and
[RELEASE_PROCESS.md](./RELEASE_PROCESS.md).

```text
Browser
  |
  v
Next.js App Router
  |-- Server Components (reads and page composition)
  |-- Client Components (interactive UI only)
  |-- Server Actions / Route Handlers (trusted application boundary)
  v
Supabase
  |-- PostgreSQL (canonical commerce state, constraints, RLS, RPCs)
  |-- Auth (identity, sessions, TOTP MFA and AAL)
  `-- Storage (public product media; private payment/return evidence)
```

## Runtime boundaries

- The browser is untrusted. It may express intent, but never establishes price,
  stock, payment state, refund state, staff role, or authorization.
- Server Components perform authenticated reads and map database results into
  stable view models. Client Components receive normalized data and own only
  interaction state.
- Server Actions and Route Handlers validate input, obtain the authenticated
  identity from Supabase, and invoke canonical database boundaries. They do not
  accept browser-supplied actor identities or privileged state.
- PostgreSQL constraints, RLS, grants, and transactional RPCs are the final
  authority for commerce and authorization invariants.
- Realtime is a UI enhancement. A database refetch remains canonical after
  reconnect or ambiguous delivery.

## Domain map

| Domain | Entry points | Server boundary | Database boundary | Authoritative state | Primary coverage |
| --- | --- | --- | --- | --- | --- |
| Storefront | `/`, `/products`, `/categories/[slug]`, `/products/[slug]`, `/size-guide` | `src/lib/catalog/*`, `/api/search` | public catalog reads, `get_public_variant_availability` | published products, variants, images, inventory availability RPC | `catalog.test.mjs`, `phase_4_5.test.mjs` |
| Cart | cart badge, `/cart`, PDP add-to-cart | `src/lib/cart/actions.ts`, guest-cookie parser | carts/cart_items RLS, authenticated cart RPC | database for authenticated carts; signed/minimal cookie intent for guests | `cart-address.test.mjs`, `guest-cart.test.mjs` |
| Auth | `/login`, `/signup`, `/forgot-password`, `/update-password`, `/auth/confirm`, `/mfa/*` | `src/lib/auth/*`, `src/lib/admin/auth.ts` | Supabase Auth, `current_user_role` | Auth user/session, database role, authenticator assurance level | `auth.test.mjs`, `mfa-onboarding.test.mjs` |
| Account | `/account`, `/account/addresses`, `/orders`, `/account/support` | account pages, address/support actions | owner-scoped RLS and narrow customer RPCs | profile, addresses, owned orders and support threads | `cart-address.test.mjs`, `orders-tracking.test.mjs`, support security tests |
| Checkout | `/checkout` | `src/lib/checkout/actions.ts` | transactional checkout RPC | database prices, inventory, address ownership, order snapshot | `checkout.test.mjs`, concurrency tests |
| Orders | `/orders`, `/orders/[id]`, `/admin/orders`, `/admin/orders/[id]` | owner/admin server pages and order actions | owner RLS, transition/shipment/refund RPCs, transition trigger | immutable order snapshots, legal status history and fulfillment state | `orders-tracking.test.mjs`, `phase_3b.sql`, completion-guard pgTAP |
| Payments | customer order detail, `/admin/payments` | payment actions and admin review actions | payment submission and review RPCs | append-only submissions and canonical payment state | `gcash-expiration.test.mjs`, admin functional audit |
| Returns | order detail, `/admin/returns` | return/refund server actions | customer request and AAL2 staff-processing RPCs | eligible quantities, return disposition and refund state | Admin functional audit and domain database tests |
| Admin | `/admin/*` | admin server pages/actions; `requireAdminAal2` for mutations | admin RPCs, RLS, private helpers, audit log | database queues and immutable audit history | `admin-foundation.test.mjs`, `admin-functional-audit.test.mjs` |
| POS | `/admin/pos` | `src/lib/pos/actions.ts` | register/session and counter-sale RPCs | owned open register, locked inventory, idempotent order/payment | POS database and race tests |
| Support | `/account/support`, `/admin/support` | support actions/queries | owner/staff RLS and narrow RPCs | staff-operated conversations/messages | `support-ai-staff.test.mjs` |
| Supabase/RLS | all data-backed routes | authenticated server client or narrowly scoped trusted client | grants, RLS policies, constraints and SECURITY DEFINER RPCs | final row access and mutation authorization | pgTAP security suites and direct-negative tests |
| Audit | Admin mutation boundaries | actor-derived server actions/RPC wrappers | append-only `audit_logs` writes inside trusted functions | immutable actor/action/entity evidence | Phase 1C/3B pgTAP and Admin audit route tests |

## Authentication and authorization

Authentication strength and application role are separate:

- `aal1`/`aal2` come from Supabase Auth.
- `customer`, `cashier`, `admin`, and `super_admin` come from the canonical
  database role boundary.
- Admin mutations require server and database enforcement at AAL2. Hiding a
  control in React is only a usability measure.
- The first super-admin uses the controlled process in
  [SUPER_ADMIN_PROVISIONING.md](./SUPER_ADMIN_PROVISIONING.md). No runtime
  bootstrap route exists.

## Storage

- `product-images`: public read, trusted AAL2 write, validated PNG/JPEG/WebP.
- `payment-receipts`: private, owner submission and authorized signed reads.
- `return-proofs`: private and authorization-scoped.

Database rows remain the authorization source for private objects. Object paths
alone never establish access.

## Ownership of business rules

- UI owns interaction, accessible feedback, and display formatting; it never
  establishes canonical authorization or commerce state.
- Server actions and route handlers own request validation, safe error
  translation, authenticated session lookup, and invocation of narrow RPCs.
- Supabase Auth owns identity, session lifecycle, MFA factors, and AAL claims.
- PostgreSQL owns prices, totals, inventory, order/payment/return transitions,
  idempotency, grants, RLS enforcement, and audit persistence.

## Background assumptions

The commerce and support paths do not depend on Gemini, n8n, or another
background worker. Historical automation/AI schema remains because applied
migration history and stored records are immutable. Realtime delivery is not a
transactional dependency.

## Data-shape rule

PostgREST relation cardinality is normalized immediately after a query. Pages
and Client Components consume stable domain types: one-to-one and many-to-one
relations become an object or `null`; one-to-many relations become arrays.
Components must not guess whether a relation arrived as an object or array.
