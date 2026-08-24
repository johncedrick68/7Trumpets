# Architecture Rules

- Use Next.js App Router and TypeScript for the application layer.
- Use Supabase PostgreSQL, Auth, Storage, and Realtime within their documented trust boundaries.
- Keep authoritative pricing, discounts, shipping, inventory, payment, refund, authorization, and admin decisions off the browser.
- Store money in integer minor units and snapshot historical order facts.
- Keep payment, fulfillment, returns, refunds, and shipments as distinct lifecycles.
- Keep the five-stage customer order timeline independent of maps, GPS, and courier APIs.
- Keep shipment concepts provider-agnostic; do not activate a vendor marketplace or assume a courier integration.
- Treat Realtime as an authorized notification mechanism followed by canonical database reads.
- Prefer server code for orchestration. Use database functions when transaction boundaries or atomicity justify them.
- Do not implement future phases before `docs/PROJECT_STATUS.md` authorizes them.
