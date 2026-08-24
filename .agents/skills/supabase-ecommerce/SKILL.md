---
name: supabase-ecommerce
description: Design or review Supabase database, authorization, storage, transaction, migration, and Realtime work for this commerce project.
---

# Supabase E-commerce Procedure

Use this skill for Supabase schema, RLS, Storage, Realtime, or transactional business operations.

1. Read the canonical architecture, security model, and active phase before proposing changes.
2. Define the invariant and trust boundary before choosing server code or a database function.
3. Prefer server code for ordinary orchestration. Use a PostgreSQL function/RPC only when a database transaction or atomic operation must span steps.
4. Express schema changes as forward-only migrations with primary keys, foreign keys, `NOT NULL`, checks, uniqueness, and deletion behavior where required.
5. Keep authoritative money in integer minor units; never trust browser totals or stock.
6. Use row locking, conditional updates, or equivalent transactional controls for reservations and stock finalization.
7. Design RLS by actor and operation. Apply least privilege and write negative cross-customer tests.
8. Use the browser publishable key only with intended RLS policies. Keep the server secret key on trusted server infrastructure and never send it to the browser.
9. Authorize each request in server code even when elevated credentials bypass RLS.
10. Keep `product-images` public-read/trusted-write; keep receipts and return proofs private.
11. Validate uploads and authorize short-lived signed URL creation for private objects.
12. Treat Realtime events as private hints. Authorize subscriptions and refetch canonical rows.
13. Review indexes for foreign keys, expected queries, policy predicates, and status/time filters; avoid speculative indexes.
14. Verify migrations locally or in an approved non-production environment, including constraints, rollback/recovery expectations, policies, and representative queries.
15. Obtain explicit user approval before applying any production migration, policy, storage, or data mutation.

Report the chosen transaction boundary, authorization model, migration verification, and unresolved production risk.
