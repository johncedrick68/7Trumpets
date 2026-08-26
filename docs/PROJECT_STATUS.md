# Project Status

CURRENT PHASE: 4–5 R3 (VERIFIED — READY TO COMMIT)

PHASE 0: APPROVED

PHASE 0.5: CLOSED

PHASE 1A: CLOSED

PHASE 1A.1: CLOSED

PHASE 1A.2: CLOSED

PHASE 1B: LOCAL SUPABASE INITIALIZED

PHASE 1C: LOCAL MIGRATIONS AUTHORED / VERIFIED

PHASE 1D: HOSTED DEVELOPMENT VERIFIED / CLOSED

PHASE 2: CLOSED

PHASE 2A: APPLICATION FOUNDATION VERIFIED

PHASE 2B: SUPABASE SSR CLIENTS & REGENERATED TYPES VERIFIED

PHASE 2C: CUSTOMER AUTHENTICATION & PROFILE VERIFIED

PHASE 2D: PUBLIC CATALOG READ EXPERIENCE VERIFIED

PHASE 2E: CUSTOMER CART & SAVED ADDRESSES VERIFIED

PHASE 2F: CHECKOUT & TRUSTED ORDER CREATION VERIFIED

PHASE 2G: CUSTOMER ORDER HISTORY / GCASH PROOF / TRACKING VERIFIED

PHASE 2H: ADMIN FOUNDATION & AAL2 BOUNDARY VERIFIED

PHASE 3A: PRODUCTION READINESS AUDIT COMPLETE

PHASE 3B: OPERATIONAL POLICIES & SECURITY BOUNDARIES VERIFIED

LOCAL SUPABASE: INITIALIZED / VERIFIED (16 MIGRATIONS REPLAY CLEAN)

HOSTED SUPABASE: LINKED (7trumpets-dev / eckhwcoigctkczzmkwqi / ap-southeast-1) — 16 MIGRATIONS PRESENT; RPC GRANT PARITY VERIFIED

DATABASE SCHEMA: 22-TABLE CONTRACT AUTHORED / LOCALLY & REMOTELY VERIFIED

MIGRATIONS LEDGER:
- Original canonical migrations: 8
- Additive Phase 1D corrections: 2
- Additive Phase 3B policy & abuse boundaries: 3
- Additive Phase 4 catalog, inventory, and grant-normalization boundaries: 3
- Total migrations: 16

PRODUCTION: NOT CREATED / UNTOUCHED

PUBLIC SIGNUP SMOKE: PLATFORM-LIMITED (Rate limit / platform constraint recorded)

LEAKED-PASSWORD PROTECTION: PRE-PRODUCTION CONFIGURATION ACTION REQUIRED (to be enabled before launch)

The locked Phase 1 database contract is `docs/phases/PHASE_1_DATABASE_DESIGN.md`.
Phase 1D is complete and closed: 10 migrations replay cleanly, the database test suite (175/175) passes, concurrency harnesses pass locally and remotely, the 22-table schema and approved storage buckets are verified, and remote security/role invariants are strictly enforced on hosted development. Hosted Supabase (7trumpets-dev) is verified. Production has not been created, linked, or mutated.

Phase 2A established the minimal Next.js App Router application foundation, strict TypeScript, flat ESLint configuration, modern `.env.example` placeholders, accessible CSS tokens, clean build, and foundational quality test gates.

Phase 2B established `@supabase/supabase-js` and `@supabase/ssr` client integration, browser/server client helpers, Next.js proxy session refresh integration, freshly regenerated database types from the 10-migration schema, and environment key isolation.

Phase 2C established customer authentication with server-side actions, token-hash verification routes (`/auth/confirm`), password reset, password update, sign in, sign out, and owner-isolated profile updates (`/account`).

Phase 2D established the public catalog read experience, including server-side query helpers (`src/lib/catalog/queries.ts`), responsive category/product listings (`/products`, `/categories/[slug]`), and detailed product view (`/products/[slug]`) supporting options, variants, and product images backed by the database schema.

Phase 2E established authenticated customer cart management (`/cart`), item add/quantity update/remove actions with server-authoritative pricing (`src/lib/cart/actions.ts`), and saved address management (`/account/addresses`, `src/lib/addresses/actions.ts`) enforcing one-default-address semantics and owner-isolated RLS.

Phase 2F established authenticated checkout (`/checkout`) and order confirmation (`/orders/[id]`), executing atomic order creation, authoritative repricing, inventory reservation, and payment initiation strictly via canonical database RPC `public.checkout_order`.

Phase 2G established authenticated customer order history (`/orders`), detailed tracking view (`/orders/[id]`), canonical presentation-tier fulfillment stage derivation (`src/lib/orders/status.ts`), and private Manual GCash payment receipt upload and proof submission (`src/lib/payments/actions.ts`) with magic byte validation, short-lived signed URLs, and immutable payment evidence preservation.

Phase 2H established the secure admin operational foundation (`/admin`), server-side role verification backed by `private.user_roles` in PostgreSQL (`src/lib/admin/auth.ts`), AAL2 enforcement for super_admin staff role management (`/admin/users`, `public.manage_user_role`), GCash payment verification queue with transactional approval/rejection (`/admin/payments`), fulfillment lifecycle transitions (`/admin/orders`, `/admin/orders/[id]`), COD settlement actions, and immutable audit logs visibility (`/admin/audit`). Phase 2 application layer is complete and closed.

Phase 3A delivered the comprehensive pre-production readiness audit across security, financial integrity, storage, and platform operations.

Phase 3B codified operational policies (`docs/phases/PHASE_3B_OPERATIONAL_POLICIES.md`) for Admin AAL2, auth abuse controls, and 5-year private payment receipt retention, and established additive database migration boundaries (13 total migrations) with pgTAP (217/217 PASS) and hosted development verification.

Phase 4–5 R3 has a clean 16-migration local replay, pgTAP (279/279 PASS), database lint with no schema errors, regenerated local database types, passing local and hosted concurrency harnesses, hosted AAL2 verification, identical local/hosted ACLs for all nine Phase 4 RPCs, and passing application test/lint/typecheck/build gates. The additive grant-normalization migration removes inherited `service_role` execution and leaves only explicitly authorized `authenticated` wrappers executable.
