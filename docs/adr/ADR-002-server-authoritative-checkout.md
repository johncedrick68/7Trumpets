# ADR-002: Server-Authoritative Checkout

## Status

Accepted

## Context

Browser-submitted prices, discounts, shipping, and stock can be stale or
manipulated.

## Decision

The browser submits purchase intent. Trusted server processing recalculates the
checkout from authoritative data and commits consequential changes
transactionally.

## Consequences

Client totals are previews only. Checkout needs integration tests for stale,
tampered, duplicate, unauthorized, and unavailable-item requests.
