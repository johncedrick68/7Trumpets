# Existing COD order presentation repair

Checkout transaction and COD order creation: **PASS**. Post-success rendered
presentation: **INCOMPLETE**. Case O: **PARTIAL**. V2 checkout: **NOT COMPLETE**.
GCash: **NOT RUN**. No new order, proof, payment or inventory operation.

## Data pipeline and repair

Read-only local database confirmation of order
`4ddaaa97-2822-46bf-b69a-fc91368e6951` / `ORD-20260929-96E4716469`:
customer `ae29c23e-f34c-4eeb-89fe-21a6976e8ecd`; CONFIRMED;
subtotal 49900, shipping 15000, total 64900.
Order item: product_name `Rise to Defend`, variant_name **`Size S`**,
variant_id `a1000000-0001-0000-0000-000000000001`, selected_options `{}`,
quantity 1, unit_price_minor 49900, line_total_minor 49900.

The first mismatch is presentation casing, not missing data:
database snapshot → order_items select("*") → array result → itemsRes.data →
item.variant_name JSX all preserve `Size S`. The variant element's `uppercase`
CSS transforms browser-visible innerText to `SIZE S`; the case-sensitive UAT
assertion expected `Size S`. No query projection or normalization repair was
needed. No live catalog join or speculative legacy fallback was introduced.
The persisted historical snapshot remains authoritative.

UI repair preserves original label casing, increases variant text to text-sm,
and removes SKU from customer order items. A null variant produces no option
row or placeholder. Quantity and canonical money formatting remain unchanged.
Owner-scoped authenticated query and safe ORDER_UNAVAILABLE versus notFound
distinction are unchanged. No checkout action/RPC/settings/migration changes.

## Tests and navigation context

Actual Server Component regression harness executes the existing queries and
renders the actual page JSX with isolated data dependencies. Before repair,
variant case and SKU assertions failed; after repair five focused tests pass.
These are isolated component tests, not authenticated rendered UAT.
Coverage: immutable variant, null variant, ownership filter, query error versus
not-found, anonymous redirect, one useful H1 and non-sensitive title.

Existing H1 identifies the order. Added metadata title `Order details`, using
the root `1968 Clothing` title template. Installed Next.js app router announcer
source prioritizes document.title, then H1 innerText/textContent. Previous BODY
focus alone does not prove lost navigation context. No custom focus/autofocus
was added; actual owner route-announcement and keyboard QA remain pending.

Anonymous browser visit to the existing local order redirected to login with
no order contents, zero unexpected console/page errors and zero checkout POSTs.
All non-GET/HEAD browser requests were blocked. This check used the existing
local build and was repeated on the repaired production build; authorization
logic is unchanged.
Existing order-tracking regression checks retain owner isolation coverage;
rendered cross-customer test remains pending, no identity was created.

## Remaining external boundary

**OWNER SESSION UNAVAILABLE.** The prior runtime-only password/session was
discarded and signed out. Auth state was not changed in this repair. A new
narrow password-only local fixture recovery authorization is required for:

- rendered variant, owner access and route announcement on the existing order;
- cart/bag reload and count agreement;
- actual success-page axe, keyboard and console/hydration checks;
- responsive widths 320, 390, 768, 1280 and 1440.

Do not submit checkout again. The existing order is sufficient. No full WCAG
claim, focus PASS or responsive PASS is made for this untested owner state.

## Gates and handoff

TypeScript PASS; ESLint PASS; production build PASS. Application suite PASS,
157/157, zero skips, normal termination; focused presentation 5/5;
admin regression 19/19.
No database reset. Existing immutable order retained.

Changed files: customer order detail page, focused presentation regression,
order-tracking suite import (includes it in npm test), this report.
Focused commit SHA is recorded in the handoff; no amend or push.
Local QA scripts/evidence in .tmp remain excluded. Remote/production actions:
NONE. No Auth recovery, role changes, deployment, merge or remote migration.

COD Case O remains PARTIAL until the existing-order owner browser checks pass.
Even after COD passes, GCash requires separate authorization and V2 checkout
remains incomplete until that rendered handoff is verified. Stop here.
