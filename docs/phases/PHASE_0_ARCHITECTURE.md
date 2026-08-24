# Phase 0 Architecture Contract

Status: APPROVED

## Platform

The product is a production e-commerce platform using Next.js App Router,
TypeScript, Supabase PostgreSQL, Supabase Auth, Supabase Storage, Supabase
Realtime, and Vercel.

## Approved Contracts

- The browser is untrusted and never authoritative for financial, inventory, payment, refund, authorization, or admin facts.
- Authoritative money uses integer minor units; checkout is recalculated on the server.
- Orders snapshot historical item, amount, recipient, and delivery facts.
- Payment and fulfillment are distinct state machines.
- Inventory reservation and final stock operations are transactional and prevent overselling.
- Initial payment methods are Cash on Delivery and Manual GCash.
- Payment evidence is private and customer submission cannot establish `PAID`.
- Customer progress is `CONFIRMED`, `PREPARING`, `SHIPPING`, `ARRIVING`, and `DELIVERED`.
- Tracking works without maps, GPS, or courier APIs, and shipment concepts remain provider-agnostic.
- Returns and refunds have distinct lifecycles.
- Schema changes use migrations; sensitive data uses intentional RLS and least privilege.
- `product-images` is public-read/trusted-write; `payment-receipts` and `return-proofs` are private.
- Admin authority requires auth, role, server authorization, database enforcement, and MFA before launch.
- Realtime is a private, authorized enhancement followed by canonical database reads.
- The experience is mobile-first, professional, accessible, and tested at relevant unit, integration, security-negative, build, and lint levels.
- Production mutation and deployment are never automatic.

`docs/architecture/MASTER_ARCHITECTURE.md` is the canonical organized form of
this approved contract. Topic documents may add explanation but not change its
meaning.
