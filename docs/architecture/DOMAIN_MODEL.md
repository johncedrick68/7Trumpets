# Domain Model

Status: Approved conceptual boundaries; not a physical schema

## Core Domains

- Catalog provides authoritative product identity, presentation, price, and sellable state.
- Checkout accepts customer intent and recalculates authoritative prices, discounts, shipping, and availability on the server.
- Orders preserve historical purchase, recipient, address, and amount snapshots.
- Inventory tracks available stock and concurrency-safe reservations separately from browser state.
- Payments track COD or Manual GCash claims and trusted verification separately from fulfillment.
- Fulfillment tracks operational progress and exposes the five-stage customer timeline.
- Shipments carry provider-neutral delivery references and may be managed manually.
- Returns track customer return requests and handling independently from order success progress.
- Refunds track financial reversal independently from return and fulfillment state.
- Evidence includes private payment receipts and return proofs.

## Cross-Domain Rules

Money uses integer minor units. Checkout and inventory decisions are
server-authoritative. Orders snapshot facts rather than depending on mutable
catalog or address records. Payment, fulfillment, returns, refunds, and
shipments have explicit transitions and do not imply one another.

Retryable checkout, payment, and future webhook operations require idempotency.
No vendor marketplace behavior is part of the approved model.
