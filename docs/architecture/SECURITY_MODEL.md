# Security Model

Status: Approved security contract

## Trust Boundary

The browser is untrusted. It can request an operation but cannot establish
money, inventory, payment, refund, authorization, or admin facts.

## Enforcement

- Supabase Auth establishes identity, not permission by itself.
- Server code authenticates and authorizes each consequential operation.
- PostgreSQL constraints and RLS enforce durable row and data boundaries.
- Elevated server access never replaces request-level authorization.
- Admin access requires auth, role checks, server authorization, database enforcement, and MFA before launch.

## Credentials

The browser publishable key may be exposed only with intentional RLS. The server
secret key and other secrets stay on trusted server infrastructure and must not
be sent to clients or printed in logs.

## Required Isolation

- Customer A cannot read Customer B's order.
- Customer A cannot receive Customer B's Realtime update.
- A customer cannot set `PAID` or modify stock.
- A customer cannot access another customer's receipt or return proof.

## Sensitive Operations

Use idempotency for retryable financial and order operations. Verify future
webhook signatures before processing. Validate uploads, apply justified rate
limits, and retain an audit trail for sensitive admin, inventory, payment, and
refund mutations.

Never disable RLS or broaden ACLs as a troubleshooting shortcut.
