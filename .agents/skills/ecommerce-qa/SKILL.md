---
name: ecommerce-qa
description: Plan and execute risk-based tests for this project's commerce, concurrency, authorization, and end-to-end flows.
---

# E-commerce QA Procedure

Use this skill when planning a phase, implementing consequential behavior, or reviewing release readiness.

1. Read the active phase and changed contracts; test only relevant scope while preserving critical negative coverage.
2. Add unit tests for money arithmetic, discount rules, status-to-customer-stage mapping, and transition validation.
3. Add integration tests for authoritative checkout recalculation, inventory reservation/release, payment verification, and atomic order-status operations.
4. Run a concurrency test in which two buyers attempt to purchase the last item; no successful path may oversell.
5. Add cross-tenant security-negative tests for orders, private receipts, return proofs, mutations, and Realtime delivery.
6. Add end-to-end coverage for COD checkout, Manual GCash evidence submission and verification, customer order tracking, and admin fulfillment.
7. Include invalid, duplicate, stale, unauthorized, expired, and retry cases around consequential operations.
8. Run the relevant unit, integration, security-negative, end-to-end, lint, type, and build checks supported by the phase.
9. Report commands, results, skipped checks, environment limits, and residual release risk without claiming unrun checks passed.
