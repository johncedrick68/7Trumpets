# Realtime Model

Status: Approved Realtime contract

Realtime improves responsiveness but is not the source of truth. The database
remains canonical.

## Flow

1. Authorize the customer and the order scope before subscription.
2. Deliver only events for rows the customer may read.
3. Treat an event as a signal that data may have changed.
4. Refetch the authorized canonical order state.
5. Tolerate missed, duplicate, delayed, and out-of-order events.

Customer A must never receive Customer B's order event. The application must
remain correct when Realtime is unavailable and may use ordinary refresh or
polling as a fallback. Realtime does not require or imply a courier API.
