# Phase 4 rendered checkout UAT — stopped at COD failure

**V2 CHECKOUT NOT COMPLETE. Case O is not PASS.**

Exactly one rendered COD submission was attempted. It failed with no persisted
order, payment, reservation or checkout audit. GCash was not attempted: the
user's explicit stop-on-defect rule was followed. No automatic retry occurred.
The identified RPC serialization defect has a narrow repair and regression
coverage; rendered post-repair success still needs fresh COD authorization.

## 1–9. Local guard, customer and COD evidence

1. Guard PASS: application `http://localhost:3002`, API
   `http://127.0.0.1:54321`, known database `supabase_db_7trumpets`, port 54322,
   Docker endpoint `npipe:////./pipe/dockerDesktopLinuxEngine`. The script rejects
   non-loopback browser requests and remote Docker contexts; no override exists.
2. Disposable ordinary customer `ae29c23e-f34c-4eeb-89fe-21a6976e8ecd` created
   through supported Auth fixture, normal password authentication, getUser and
   claims verified. Profile ID equals user ID; canonical role is customer only.
   No admin/super-admin/customer service-role identity or modified claims used.
3. Normal storefront PDP → Add to Bag → View Bag → Cart → Checkout.
   Rise to Defend, Size S, quantity 1;
   variant `a1000000-0001-0000-0000-000000000001`;
   canonical unit price 49900 minor units;
   cart `1715e60f-5965-4159-adae-717576031155`;
   line `63cbe05f-b4d1-41b2-9db0-6caae7c1be03`;
   selected owned address `47b50b34-5e3a-49ab-9a07-569efdfc9487`.
   Saved address/profile fixtures use existing authenticated RLS paths; no manual
   cart/order insert, browser price/shipping/customer manipulation or settings
   changes. Quantity 1 is safely below available 27.
4. Rendered quote verified: subtotal 49900 (₱499.00), shipping 15000 (₱150.00),
   total 64900 (₱649.00). COD enabled, maximum 1000000 (₱10,000.00).
   Shipping free threshold 350000. GCash and configured pickup enabled; no
   pickup order attempted. Account email, address radios and variant summary
   verified before activation.
5. COD order ID/number: **NONE**, zero orders persisted.
6. COD order/payment states: **N/A**, no rows created; not falsely called UNPAID.
7. Inventory before/after: on_hand 30 → 30; reserved 0 → 0; safety_stock 3 → 3;
   available 27 → 27; original inventory timestamp unchanged.
8. Failure safety PASS: original cart line/quantity remains. Success cart cleanup
   and successful bag refresh are **NOT TESTED** in this attempt.
9. One checkout POST, HTTP 303; destination
   `http://localhost:3002/checkout?error=checkout_failed`.
   No successful order detail or fabricated success page. Authoritative database
   read afterwards: orders 0, payments 0, reservations 0, proof submissions 0,
   this customer's order.checked_out audit rows 0.

## 10–18. GCash evidence

10. New GCash cart/input cycle: **NOT RUN**; stopped before its creation.
11. GCash rendered total: **NOT RUN**.
12. GCash order ID/number: **NONE**.
13. GCash order/payment states: **N/A**.
14. GCash reservation/deadline: **NOT RUN**. Two-hour serialized expiry is covered
    by the repair regression harness, not a successful rendered order claim.
15. GCash instructions/proof handoff: **NOT RUN** in this transaction UAT.
16. Proof upload: **NOT PERFORMED**. No file/reference proof selected/submitted;
    no payment approval/rejection, POS, return or refund operation.
17. GCash inventory comparison: **NOT RUN**; no GCash order mutation occurred.
18. GCash cart cleanup: **NOT RUN**. Original failed COD cart retained.

## 19–24. Isolation, secrets, browser and submission safety

19. Customer/profile/role identity verified. Successful-order cross-customer
    isolation was **NOT RUN** because no order exists. Existing regression
    security evidence remains separate; do not label rendered isolation complete.
20. CLIENT SECRET EXPOSURE: **NONE observed** in collected browser requests.
    Browser did not invoke backend-only checkout RPC. Privileged client remains
    server-only. Exact-key scan of 96 built client JavaScript files: PASS.
    No credentials, cookies, access/refresh tokens, secret keys or TOTP seeds
    are included in this report or non-sensitive local evidence log.
21. Collected console/page/hydration errors: zero. Business rejection is visible
    through the safe error redirect, not a JavaScript crash.
22. COD pre-submit axe: one actual browser state, zero WCAG-tagged detected
    violations. COD/GCash successful order pages were **NOT SCANNED**. Later
    non-transactional QA is not a substitute for these success-page scans.
23. Live keyboard: saved address ArrowDown/ArrowUp; Delivery and COD radio
    Space selection; Place Order focus and one Enter activation. Pending button
    was disabled. Post-success heading/focus: **NOT RUN**.
24. Exactly one checkout POST, no double-click/replay. No duplicate persisted
    order (zero total). Existing rollback-based database idempotency tests remain
    authoritative; no second financial mutation was used for proof.

## Root cause and narrow repair

`processCheckout` represented non-GCash expiry as undefined. JSON serialization
omitted p_gcash_expires_at entirely. Both installed checkout_order signatures
require this argument (only customer_note has a SQL default), so COD's request
cannot resolve the expected PostgREST overload. Database SQL tests explicitly
passed NULL and the earlier action mock did not test serialized wire presence.

Repair: send explicit null for non-GCash expiry; retain the existing two-hour
ISO timestamp for manual GCash. This preserves the existing contract, not a new
one: no schema/grant/RLS/MFA/identity/price/shipping/inventory change, no new RPC,
and no new migration. The serialized COD regression fails before this fix and
passes after it. The GCash expiry regression verifies the two-hour interval.
This is not a claim of post-repair rendered success.

## 25–34. Gates and completion decision

25. Application regression: PASS, 152/152, normal termination; live customer
    assertions executed rather than silently skipped. Focused settings/action
    suite: PASS, 18/18, including COD null and two-hour GCash expiry.
26. TypeScript: PASS.
27. ESLint: PASS.
28. Admin regression: PASS, 19/19.
29. Production build: PASS. Non-transactional checkout QA: PASS, 17 axe states,
    176 viewport/state checks, native keyboard and error focus, zero console/page
    errors, checkout POSTs and orders. Isolated SSR states are not rendered
    transaction UAT. No stock fixtures, reset, order retries or remote actions.
    Broader storefront runner exited normally: 17 axe states with zero violations,
    14 keyboard/interaction checks and 44 responsive checks passed. Stock case D
    was NOT RUN (no fresh stock mutation authorization); prior evidence remains
    separate. These checks do not establish successful checkout persistence.
30. Working tree: focused repair/evidence changes; local screenshots and one-shot
    UAT script/log in `.tmp` remain excluded from commits. Customer, addresses,
    cart and normal failed-attempt limiter state retained as local evidence.
    No unsupported deletion of orders/audits or inventory repair/reset occurred.
31. Case O: COD **FAIL before repair / post-repair rendered retest PENDING**;
    GCash **NOT RUN / PENDING**. Not PASS.
32. **V2 CHECKOUT NOT COMPLETE.** Fresh authorization for a new rendered COD
    submission is required. The original GCash authorization was not used;
    it remains unexecuted at the stop boundary.
33. Manual GCash proof/upload/payment verification remains separately scoped and
    unauthorised. Even a future successful GCash checkout will not complete it.
34. Remote/production actions: **NONE**. No push, deployment, merge, remote
    migration, production credentials or production transactions.

Non-sensitive raw evidence: `.tmp/checkout-uat-ledger.json`. Its attempted flag
was written before Enter. The one-shot script refuses to run when that log
exists; do not remove it to retry a consumed authorization.
