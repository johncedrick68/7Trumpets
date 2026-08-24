---
name: ecommerce-security
description: Threat-model and verify authorization, RLS, storage, payments, uploads, admin access, Realtime, and sensitive commerce mutations.
---

# E-commerce Security Procedure

Use this skill for sensitive features and security reviews.

1. Identify actors, assets, entry points, trust boundaries, and each allowed operation.
2. Enforce authorization in server code and database RLS/constraints where applicable; UI hiding never grants or denies authority.
3. Require authenticated role checks for admin actions and MFA for admins before launch.
4. Keep server secret keys and webhook secrets on trusted infrastructure; never expose or log them to the browser.
5. Validate upload ownership, purpose, MIME/content, size, extension, and storage path; keep receipts and return proofs private.
6. Authorize short-lived signed URLs at request time and avoid persistent public links to private evidence.
7. Use idempotency for checkout, payment, refund, and webhook-sensitive mutations.
8. Verify webhook signatures before processing and reject stale, replayed, malformed, or unexpected events.
9. Apply rate limits where abuse impact justifies them, especially authentication, evidence upload, and expensive mutations.
10. Audit sensitive admin, payment, refund, inventory, and authorization changes with actor, action, target, and time.
11. Add negative tests for every sensitive boundary.

Required denials:

- Customer A cannot read Customer B's order.
- Customer A cannot receive Customer B's Realtime update.
- A customer cannot set `PAID`.
- A customer cannot modify stock.
- A customer cannot access another customer's receipt.

Do not approve the feature while any required denial is unverified.
