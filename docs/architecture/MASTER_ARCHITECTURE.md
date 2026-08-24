# Master Architecture

Status: Approved Phase 0 architecture contract

## Purpose and Stack

This project is a production e-commerce platform built with Next.js App Router,
TypeScript, Supabase PostgreSQL, Supabase Auth, Supabase Storage, Supabase
Realtime, and Vercel.

This document is canonical. Topic documents deepen it but may not contradict it.

## Authority and Trust

The browser is untrusted and may express intent only. Trusted server processing
and PostgreSQL establish authoritative prices, discounts, shipping charges,
inventory, payment and refund state, authorization, and admin state.

Critical data invariants belong in database constraints and transactional
operations. Server code must authorize requests even when using elevated access.

## Commerce Contracts

- Store and calculate money in integer minor units.
- Recalculate checkout from authoritative data on the server.
- Snapshot historical item, price, discount, shipping, total, recipient, and address facts in orders.
- Keep payment, fulfillment, return, refund, and shipment lifecycles distinct.
- Make consequential create/transition operations idempotent where retries are possible.
- Reserve and finalize inventory transactionally with concurrency protection.

## Order Experience

The customer success timeline is `CONFIRMED`, `PREPARING`, `SHIPPING`,
`ARRIVING`, and `DELIVERED`. It must work with manual operations and without a
map, GPS, or courier API. Exceptions are represented separately.

The shipment model is provider-agnostic. No courier provider or vendor
marketplace is activated by this architecture.

## Payments

Initial methods are Cash on Delivery and Manual GCash. Payment state is not
fulfillment state. Customer-submitted payment evidence is a claim for review,
not authority to set `PAID`.

## Data and Authorization

Schema changes are forward-only migrations. Sensitive browser-reachable data
uses intentional RLS and least privilege. RLS must not be weakened to fix app
errors, and server-only tables do not need meaningless browser policies.

The browser may use a publishable Supabase key with RLS. A server secret key is
restricted to trusted server infrastructure and is never browser-safe.

## Storage

- `product-images`: public read and trusted write
- `payment-receipts`: private
- `return-proofs`: private

Private objects require authorized, short-lived signed URLs. Uploads require
owner, purpose, type, size, and path validation.

## Realtime

Realtime is an authorized enhancement. Events prompt reconciliation with a
canonical database fetch. Customers must receive only updates they are allowed
to read; correctness cannot depend on receiving every event.

## Administration

Admin authority requires authentication, role verification, server-side
authorization, and database enforcement. UI visibility is not authorization.
Admin MFA is required before production launch.

## Delivery and Quality

The user experience is mobile-first, professional, accessible, and clear. Build
phases verify relevant unit, integration, security-negative, lint, and build
checks. Production migrations, deployment, destructive data actions, commits,
and pushes require explicit authorization where applicable.

## Phase Boundary

Phase 0.5B creates documentation and AI harness configuration only. It creates
no application scaffold, schema, migration, bucket, infrastructure, or
production connection. Phase 1 has not started.
