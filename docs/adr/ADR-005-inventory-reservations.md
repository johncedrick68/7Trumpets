# ADR-005: Inventory Reservations

## Status

Accepted

## Context

Concurrent checkouts can oversell stock, while abandoned checkout attempts can
hold inventory indefinitely.

## Decision

Use transactional, concurrency-safe inventory reservations with explicit
release/expiry and exactly-once finalization behavior. The browser never owns
stock state.

## Consequences

Checkout needs atomic database operations, idempotency, reservation cleanup,
and a last-item concurrency test. Exact schema and timing belong to Phase 1.
