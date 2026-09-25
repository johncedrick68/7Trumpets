# Domain Invariants

These rules must not change accidentally during refactoring.

## Authentication and staff governance

- AAL2 proves completion of a verified second factor; it does not elevate role.
- `admin` and `super_admin` are distinct canonical database roles.
- An ordinary admin cannot promote itself or manage protected roles.
- Initial super-admin creation is a trusted owner/operator transaction against
  an independently verified Auth UUID.
- Later role changes use the canonical AAL2 super-admin governance boundary.
- The last super-admin and protected self-mutations remain guarded.

## Cart and checkout

- Guest cart content is untrusted intent and never carries canonical money.
- Server/database data establishes prices, variant status, and availability.
- Guest-to-user reconciliation is replay-safe and a failed merge does not
  silently destroy guest intent.
- Checkout requires an authenticated owner and a valid owned address.
- Order creation, reservation/stock movement, totals, and idempotency are
  transactional database responsibilities.

## Inventory

- Inventory is database-authoritative and cannot become negative.
- Reserved and on-hand quantities are changed only through trusted boundaries.
- UI availability cannot override locked database checks.

## Money

- Canonical money uses integer minor units (PHP centavos).
- Formatting is presentation only; calculations never parse formatted strings.
- Line, subtotal, shipping, discount, order, refund, and POS totals are
  recalculated at trusted boundaries.

## Orders and fulfillment

- Only declared transitions are legal.
- Cancelled and terminal states cannot transition illegally.
- Payment status and fulfillment status remain separate.
- Every payment-requiring `DELIVERED -> COMPLETED` transition requires a
  canonical payment row in `PAID` state. The database trigger enforces this for
  UI/server-action/RPC and direct-SQL callers across the tested COD, manual
  GCash, store-pickup, and POS paths.
- Replacing a trigger function must preserve all previously established guards;
  additive transition support must not erase older invariants.
- Order rows snapshot historical product, price, quantity, discount, delivery,
  and fulfillment facts.

## Payments and returns

- Customer evidence cannot establish `PAID`.
- Approval/rejection is canonical, authorized, and non-repeatable.
- A query error is not an empty queue.
- Return quantity cannot exceed eligible quantity; duplicate processing is
  rejected; refund state is authorized and auditable.

## POS

- A sale requires an OPEN register owned by the authenticated operator.
- Role and AAL2 checks remain enforced server-side and in PostgreSQL.
- Register rows and inventory are locked as required by the transaction.
- Idempotency prevents duplicate counter sales.

## Support

- Support is staff-operated; Gemini, n8n, and an AI assistant are not live
  runtime dependencies.
- Customers can access only their conversations and cannot author staff/internal
  messages or mutate privileged lifecycle fields.
- Internal notes never reach customer views.
