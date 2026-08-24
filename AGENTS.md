# Project Purpose

Build a production e-commerce platform using:

- Next.js App Router
- TypeScript
- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage
- Supabase Realtime
- Vercel

The canonical architecture is `docs/architecture/MASTER_ARCHITECTURE.md`.
Work only within the active phase recorded in `docs/PROJECT_STATUS.md`.

# Authority Order

Resolve conflicts in this order:

1. User explicit instruction
2. Approved architecture contract
3. `AGENTS.md` project rules
4. Security and data-integrity rules
5. Active phase contract
6. Specialist skills
7. Ponytail and minimalism
8. Generic defaults

# Trust Boundary

The browser is untrusted. It may express intent, but it is never authoritative
for:

- money
- prices
- discounts
- shipping amount
- inventory
- payment state
- refund state
- authorization
- admin state

Recalculate and authorize consequential operations on the server and enforce
critical invariants in PostgreSQL.

# Money

Use integer minor units for authoritative monetary values and arithmetic.

PHP example: `₱2,999.00 = 299900 centavos`.

Do not use floating-point arithmetic for authoritative financial calculations.

# Orders

Payment state and fulfillment state are separate.

Orders snapshot historical business facts, including purchased item identity,
quantity, unit price, discounts, shipping charge, totals, and delivery details.

Customer progress uses:

- `CONFIRMED`
- `PREPARING`
- `SHIPPING`
- `ARRIVING`
- `DELIVERED`

The progress model must work without a map, GPS, or courier API.

# Inventory

Inventory is never client-authoritative.

Final stock operations must be transactional and concurrency-safe. Prevent
overselling, including simultaneous attempts to purchase the last item.

# Payments

Initial payment methods are Cash on Delivery and Manual GCash.

Payment proof is private. A customer may submit evidence but cannot establish
the `PAID` state. Trusted server or authorized admin processing controls payment
state transitions.

# Database

Manage schema changes through migrations. Do not rewrite applied migration
history or manually mutate production schema for ordinary development.

Use database constraints for durable invariants. Review indexes against actual
query and authorization paths.

# RLS / ACL

Sensitive tables require intentional authorization and least privilege.

Do not weaken Row Level Security to fix application errors. Do not create
meaningless browser policies for server-only tables. Server access does not
remove the need for explicit authorization.

# Storage

- `product-images`: public read, trusted write
- `payment-receipts`: private
- `return-proofs`: private

Validate uploads. Use short-lived signed URLs for authorized private access.

# Admin

UI hiding is not authorization.

Admin operations require authentication, role verification, server-side
authorization, and database enforcement. Admin MFA is required before launch.

# Realtime

Realtime is an enhancement, not canonical truth. Reconcile events with a
database fetch. Order updates must be private and authorized; one customer must
never receive another customer's order updates.

# Courier

Keep the core order and shipment model provider-agnostic. Do not assume Maxim,
J&T, or any other courier API exists.

# UX

- mobile-first
- professional commerce presentation
- accessible semantics and labels
- clear primary action
- touch targets at least 44px
- no color-only state communication
- no unnecessary motion
- no generic AI-dashboard visual clutter

Keep the customer storefront distinct from the admin dashboard.

# Testing

Every build phase must verify the relevant subset of:

- unit tests
- integration tests
- security-negative tests
- build
- lint

Financial, authorization, transaction, and concurrency paths require tests that
fail when their contract is broken.

# Production Safety

No agent may automatically do any of the following without explicit user
authorization where applicable:

- apply a production migration
- deploy production
- print secrets
- force push
- commit
- disable RLS
- broaden ACLs
- delete business data

Never connect to or mutate production unless the active request explicitly
authorizes that exact operation.

# Minimalism

Use the minimum correct implementation in this order:

1. understand the complete flow
2. apply YAGNI
3. reuse existing project code
4. use the standard library
5. use native platform capabilities
6. use an existing dependency
7. write the minimum new code
8. introduce an abstraction only when the current need proves it

Avoid speculative systems, wrapper layers, factories, and dependencies. Build
only active-phase scope.

Minimalism never overrides architecture, security, correctness, financial
integrity, transactional safety, accessibility basics, or explicit user scope.

# Host Integration

Antigravity consumes this file and `.agents/` as instruction-tier project
guidance. Do not assume Ponytail slash commands or mode switching exist there.

OpenCode receives the full Ponytail discipline from the official plugin in
`opencode.json`, with FULL as the project default. Do not copy the complete
upstream Ponytail ruleset into project files.
