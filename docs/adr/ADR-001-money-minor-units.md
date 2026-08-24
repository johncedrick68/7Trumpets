# ADR-001: Money in Minor Units

## Status

Accepted

## Context

Floating-point arithmetic can produce inaccurate financial results.

## Decision

Store and calculate authoritative money as integer minor units. For Philippine
pesos, `₱2,999.00` is `299900` centavos. Define rounding only at explicit
conversion boundaries.

## Consequences

Totals are exact and testable. Formatting converts minor units for display, and
integrations must convert explicitly at their boundaries.
