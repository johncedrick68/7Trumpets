# Phase 4 — checkout visual and UX rebuild

## Subsequent rendered UAT checkpoint

The one authorized COD submission failed without creating an order. GCash was
not attempted because testing stopped on the defect. Non-GCash RPC expiry was
being omitted by JSON; the narrow repair sends the required explicit null.
Case O remains NOT PASS and V2 Checkout is NOT COMPLETE pending freshly
authorized rendered COD retest and the still-unperformed GCash checkout.
See [rendered UAT evidence and repair](V2_CHECKOUT_RENDERED_UAT.md). The visual
baseline and historical gate counts below remain evidence for their checkpoint,
not a claim that successful transaction UAT has passed.

Scope: `rebuild/1968-v2`, checkout presentation only. Security baseline
`2a5a0d1` and canonical stock/live-session evidence `b1adb12` are preserved.
The checkout action, shipping helper, settings contract, RPCs, migrations,
admin, cart, and auth/account pages are unchanged.

## 1–6. Reference, audit, preservation, and visual comparison

1. Reference studied: [UA collection](https://www.uaworldwide.com/collections/all)
   and [UA cart](https://www.uaworldwide.com/cart). Observed product-led hierarchy,
   simple product/price presentation and an explicit estimated total/shipping
   distinction. Direct UA checkout was inaccessible to the research tool; no
   claim is made that its authenticated checkout was inspected. The two-column
   checkout and quiet header follow the approved user brief, not inferred UA
   policies. No UA shipping, promotions, timings, logos or business claims copied.
2. Before: decorative rounded cards, unverified pickup location/hours and
   delivery promises, missing account context, unlabeled address controls,
   browser shipping arithmetic and no COD ceiling presentation.
3. Preserved: authenticated checkout, real owner-scoped saved addresses/cart,
   configuration fail-closed, canonical shipping, server-only privileged RPC,
   locked prices/stock, exact COD ceiling, idempotency, success-only cart cleanup,
   and `/orders/{id}` success destination. See
   [security contract](V2_CHECKOUT_CONTRACT.md) and
   [immutable repair evidence](V2_CHECKOUT_REPAIR_REPORT.md).
4. After: checkout-specific quiet logo/Back to Cart header; single Checkout H1;
   flat divided task sections; native radios; square CTA; restrained summary
   with real images, wrapping titles, quantities and dominant total. No search,
   announcement, collection navigation or footer clutter on this route only.
5. Desktop before/after screenshots: `.tmp/checkout-qa/before-desktop.png` and
   `.tmp/checkout-qa/after-desktop.png`. Natural 60/40 desktop grid, with sticky
   summary and reachable CTA. Other storefront chrome remains unchanged.
6. Mobile screenshots: `.tmp/checkout-qa/before-mobile.png` and
   `.tmp/checkout-qa/after-mobile.png`. Task sections precede summary/total/CTA;
   no fixed mobile CTA. Local artifacts are deliberately excluded from Git.

## 7–20. Flow and UI behavior

7. Account displays verified user's email and optional textual full name;
   checkout is not a profile editor.
8. Saved addresses use labeled, required native radios and default selection.
   Empty address book is an explicit state with disabled CTA. Manage saved
   addresses uses the existing Account route; inline persistence and a new
   return-to-checkout mechanism were not invented. Pickup still requires the
   canonical saved recipient/contact record because the existing action does.
9. Delivery plus pickup only when configured. Pickup location is persisted
   configuration, with no hard-coded hours or promises. Existing `CASH` pickup
   remains supported alongside configured manual GCash: it is not a new method.
10. Server Component produces display quotes using the unchanged shipping
    helper and validated settings. Client selects a quote, not financial inputs.
    Pickup resolves to zero through the canonical helper. All amounts are minor
    units; submission independently rereads and reauthorizes everything.
11. Summary uses canonical current cart data: image, title, variant, quantity,
    line total, subtotal, Shipping and Total. No visible SKU/stock counts/IDs.
12. Payment fieldset/legend with native radios. Disabled methods are not silently
    submitted. No eligible payment gives an explicit error and disabled CTA.
13. COD below persisted maximum remains enabled.
14. COD equality remains enabled (`total > maximum`, not `>=`).
15. COD above maximum stays visible but disabled, with formatted persisted
    threshold. Eligibility is server-provided, not a second browser rule.
16. GCash says manual verification. After order placement, payment instructions
    and proof submission remain on existing order detail, within the existing
    two-hour reservation. No proof upload or payment gateway is introduced here.
17. Query/missing/malformed settings produce an operational unavailable view
    with Try Again and Back to Cart, never fallback shipping/payment options.
    Cart/address read errors are likewise not mistaken for empty states.
18. Existing safe redirect error codes map to concise copy. Error summary gets
    focus and links to address/payment/fulfillment groups or Review Cart.
    No raw database error is displayed. Unknown errors have safe generic copy.
19. Known unavailable lines disable placement and offer Review Cart. A stock
    or price change during submission retains the existing atomic rejection and
    generic actionable `checkout_failed` path. No new error taxonomy/RPC added.
20. `useFormStatus` disables CTA and announces PLACING ORDER while pending.
    Synchronous ref guard rejects a second valid submit intent; guard resets
    after pending settles. No optimistic cart cleanup. Guard behavior and pending
    presentation are tested without invoking a server action.

## 21. Case matrix A–O and evidence strength

| Case | Result / evidence |
| --- | --- |
| A Anonymous | PASS, real local browser redirect to login (stream-aware wait) |
| B Authenticated page | PASS, disposable ordinary customer with real Auth session |
| C Saved addresses | PASS, two real owner-scoped records; native selection |
| D Missing address / validation | PASS isolated actual component and server-render tests; focused error summary also live browser |
| E Delivery | PASS, real browser/current settings |
| F Pickup | PASS, real browser/current settings; configured location, cash pickup preserved |
| G COD below | PASS, server quote test and normal live browser |
| H COD exact | PASS, actual Server Component quote harness; DB boundary previously verified |
| I COD above | PASS, actual Server Component/component harness; disabled and GCash fallback; no persisted settings changed |
| J GCash | PASS, live selection and manual-flow copy |
| K Configuration unavailable | PASS, actual Server Component read-failure harness + rendered component axe/layout; not a live settings outage |
| L Stale stock | PASS component blocked-state + generic error mapping; live concurrency/checkout rejection is not rerun |
| M Responsive summary | PASS live and isolated component viewport matrix |
| N Duplicate intent | PASS actual synchronous handler unit invocation and pending component presentation; no live action request made |
| O Successful local order | **PENDING separate action-time authorization** |

## 22–25. Browser verification

22. Viewports: 320×568, 375×667, 390×844, 430×932, 768×1024, 820×1180,
    1024×768, 1280×720, 1280×800, 1440×900, 1920×1080.
    Checkout: 176 viewport/state checks (33 live delivery/GCash/pickup;
    143 isolated rendered component checks). States include multiple items,
    long title, missing address, COD exact/above, no eligible payment, settings/
    cart/address error, stale stock, validation, skeleton and pending.
    Isolated fixtures use actual rendered components, not inconsistent response
    rewrites, and are not hydrated end-to-end evidence.
23. Live keyboard: native ArrowDown/ArrowUp address selection, Tab/Shift+Tab,
    Space payment selection, Enter on Back to Cart, error-summary focus and
    error-link focus to the address group. Labels are full 44px+
    targets; pending CTA is 52px. One H1 and unique IDs verified. Enter final
    submission intentionally not exercised. Existing storefront keyboard
    regression remains separate from successful order UAT.
24. Checkout axe: 17 states, zero detected WCAG-tagged violations; four live
    states and thirteen isolated component states. Automated scans do not prove
    complete accessibility. Additional storefront: 17 axe states, zero violations;
    14 interaction and 44 responsive checks PASS. Stock scan not rerun.
25. Production-mode browser run: zero unexpected console/page/hydration errors.
    Checkout tripwire blocks POSTs; zero POSTs observed and disposable customer's
    order query verified zero orders. Static CSS/JS status and MIME checks are
    included in the final checkout QA.

## 26–33. Gates, files and commit

26. TypeScript: PASS.
27. ESLint: PASS.
28. Application: 152/152 PASS, zero skipped and normal termination.
    Live customer: 16/16 assertions executed, no hidden skip.
29. Focused settings/action checkout suite: 16/16 PASS.
30. Admin functional source regression: 19/19 PASS. No rendered admin mutation.
31. Production build: PASS. No deployment. DB unchanged; no reset performed;
    408/408 is prior baseline evidence, not a new run claim.
32. Files: checkout page/client/CSS/loading/unavailable; checkout-only chrome
    branch; checkout QA/render harness; storefront QA integration; checkout
    tests; this audit. No backend action/settings/shipping/migration changes.
33. Focused authorized local commit SHA is recorded in the final handoff. No push.

## 34–37. Remaining debt and next authorization

34. Existing authenticated Cart J/K includes contract rather than full browser
    evidence. Mixed available/unavailable PDP variants are not independently
    proven by the prior Rise fixture. Both remain open. Tenets all-out-of-stock
    fixture was previously proven/restored in b1adb12 and is NOT repeated by this
    visual task. Use `QA_SKIP_STOCK=1` for regression unless fresh inventory-write
    authorization exists. Inventory fixtures additionally require explicit
    `QA_ALLOW_STOCK_FIXTURE=1`; the default runner performs no stock writes.
    SSR boundary-state evidence is explicitly not live
    transaction UAT. Recovery/error states do not prove network-failure handling
    for a completed live order.
35. Rendered successful order UAT: **PENDING**, not falsely marked complete.
36. Actual local COD/GCash order creation and proof upload require separate
    action-time authorization. This phase sends no checkout action request.
37. Next: review the visual checkout and authorize a tightly scoped local order
    UAT if desired. Stop here: no Auth/Account redesign, deployment, merge,
    remote migration or production mutation.

## Reproduction and safety

Run `QA_BASE_URL=http://localhost:3002 QA_SKIP_STOCK=1 node scripts/storefront-qa.mjs`
with a completed local production build/server. PowerShell uses environment
assignments rather than the shell-prefix syntax above. `QA_CHECKOUT_ONLY=1`
runs only checkout. Customer fixture creates disposable ordinary Auth user,
owned saved addresses and authenticated cart items through normal allowed paths;
cleanup removes the fixture via existing customer lifecycle. Credentials and
session cookies remain in memory, are never logged or committed, and are not
fabricated claims. No privileged role, MFA bypass, order, reservation, payment,
receipt/proof, stock or settings mutation is part of this checkout QA.
