---
name: ecommerce-domain
description: Model or review commerce money, checkout, orders, inventory, payments, tracking, returns, refunds, and shipments.
---

# E-commerce Domain Procedure

Use this skill when changing commerce behavior or domain models.

1. Map the requested behavior to separate money, checkout, order, inventory, payment, fulfillment, return, refund, and shipment concerns.
2. Represent money as integer minor units and define rounding at explicit conversion boundaries.
3. Recalculate checkout server-side from authoritative products, prices, discounts, shipping rules, and available inventory.
4. Snapshot purchased item identity, quantity, unit price, discounts, shipping, totals, recipient, and delivery address on the order.
5. Keep payment state separate from fulfillment state and permit only explicit validated transitions.
6. Reserve inventory transactionally with expiry/release rules and concurrency protection; finalize stock exactly once.
7. Make checkout creation, payment submissions, and future webhook handling idempotent.
8. Map successful customer progress only to `CONFIRMED`, `PREPARING`, `SHIPPING`, `ARRIVING`, and `DELIVERED`.
9. Present cancellations, failures, returns, and refunds as exception or separate lifecycles, not fake successful progress.
10. Model returns separately from fulfillment and refunds separately from both returns and payment capture.
11. Keep shipment records provider-agnostic so manual fulfillment works without a courier API.
12. Test invalid transitions, duplicate requests, stale prices, expired reservations, and last-item concurrency.
