# Order State Machine

Status: Approved behavioral contract

## Separate State

An order must not use one status field to represent payment, fulfillment,
returns, and refunds. Each lifecycle has independent, validated transitions.

## Customer Success Timeline

1. `CONFIRMED`: the order has been accepted.
2. `PREPARING`: fulfillment is preparing the order.
3. `SHIPPING`: the order has entered delivery handling.
4. `ARRIVING`: delivery is approaching completion.
5. `DELIVERED`: delivery is complete.

Transitions move forward through the successful timeline unless an authorized
correction explicitly preserves audit history. Duplicate transition requests
must be safe.

## Exception Lifecycles

Cancellation, failed or rejected payment evidence, delivery exceptions,
returns, and refunds are not successful timeline stages. Present them as
separate states with explicit reasons and authorization.

A normal Manual GCash proof rejection does not itself cancel the order or
release an active reservation while the retry deadline remains valid. The order
stays `CONFIRMED`, payment becomes `REJECTED`, prior evidence remains immutable,
and corrected evidence creates a new submission. Final cancellation/release
requires a separate trusted, locked, revalidated, and audited resolution.

## Independence

The timeline must be operable manually and without maps, GPS, or courier APIs.
Payment verification does not automatically establish fulfillment progress, and
fulfillment progress does not establish payment state.
