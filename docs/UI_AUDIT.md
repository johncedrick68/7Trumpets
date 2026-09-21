# 1968 Clothing UI/UX Audit

Status: **Phase 0–1 complete — remediation not started**  
Audit date: 2026-09-19  
Scope: customer storefront, authentication, account, orders/payments, admin, POS, and shared system states.

This document is the baseline for the full application remediation. It deliberately does not treat an individual screenshot as an isolated defect. The repeated failures come from inconsistent page geometry, density, hierarchy, and state composition.

## QA legend

- **FAIL** — a material composition, workflow, responsive, accessibility, or state problem was confirmed.
- **NEEDS WORK** — source inspection found deficiencies, but full authenticated visual verification is still required.
- **PASS** — both source and browser inspection passed at the required viewport/state matrix. No route qualifies yet.
- **N/A endpoint** — route handler with no independent page; its visible redirect/result is audited elsewhere.

## Browser inspection record

The local Next.js application and local Supabase stack were used with live catalog data.

| Surface | Viewport/state inspected | Confirmed observations |
|---|---|---|
| `/` | desktop | Header and hero do not establish a dependable shared content axis; the hero carries excessive empty vertical space and a very small brand mark. |
| `/products` | 1440×900 | Breadcrumb/title and the four-column grid touch the viewport edge. Filters, result count, and search do not form a coherent toolbar. Cards are oversized horizontally but metadata is visually cramped. |
| `/products` | 390×844 | No effective page gutter. Two-column cards make imagery and product copy too dense; titles/descriptions truncate into a noisy continuous feed. |
| `/products/1968-classic` | 1440×900 | Breadcrumb/gallery begin at x=0 while the purchase rail follows another axis. Product image dominates the page; purchase content is narrow and visually detached. |
| `/products/1968-classic` | 390×844 | Gallery touches the edge, occupies most of the first viewport, and delays the purchase task. Product heading begins below the fold. Floating support control overlaps the content region. |
| `/cart` | 390×844, signed out | The sign-in state is vertically centered with a very large dead area. Card and CTA reach the viewport edge instead of using a mobile gutter. |
| `/login` | 1440×900 | The approximately 1020px auth composition is left anchored, leaving a large unused right column. Form hierarchy is compressed inside an otherwise oversized shell. |
| `/login` | 390×844 | The form has effectively no horizontal page gutter and begins after an excessive blank region. Labels, separator, helper links, fields, and footer compete at very tight spacing. |
| `/admin/orders` | signed out | Correctly redirects to `/login?next=%2Fadmin`; authenticated admin composition remains pending a seeded admin visual session. |

Protected account and admin screens are not marked PASS based on source inspection or their redirect alone. They require visual QA with customer, admin, and MFA states after the shared shells are implemented.

## Systemic findings

1. **There is no single storefront alignment contract.** Public pages mix edge-to-edge custom classes, `max-w-5xl`, `max-w-6xl`, and `max-w-7xl`, with page-specific `px-4`. Breadcrumbs, headings, galleries, grids, checkout, account content, and the header therefore use different axes.
2. **Vertical centering is being used where task flow needs top alignment.** Signed-out cart and mobile auth create large blank regions before the primary task.
3. **Responsive behavior is mostly stacking, not recomposition.** The mobile catalog retains two dense columns; the PDP puts a large gallery before all purchase decisions; desktop auth does not recenter or use the available canvas.
4. **Customer self-service has no durable shell.** Profile, addresses, and orders are separate `max-w-5xl` pages with horizontal tabs rather than one predictable desktop navigation/content frame and compact mobile navigation.
5. **Admin uses a marketing-card vocabulary for operational work.** The `max-w-6xl` admin inner container and repeated Cards constrain queues, tables, filters, and review workspaces. Dashboard and resource details become “card soup” instead of scanable operational hierarchy.
6. **Typography is expressive but insufficiently role-based.** Monospace uppercase labels are used frequently enough to reduce contrast between navigation, metadata, labels, statuses, and secondary facts.
7. **State design is inconsistent.** Loading skeletons exist for many routes, but auth, checkout, category, unauthorized, and mutation states do not follow one state grammar. Empty states are often oversized centered cards instead of preserving page context.
8. **Floating support/navigation controls can obscure mobile content.** Their safe-area and collision behavior needs to be validated against PDP actions, forms, dialogs, and sheets.

## Route inventory and page audit matrix

Widths and spacing below describe the current implementation, not the target. “Custom/edge” means the route relies on legacy classes or full-width sections without a reliable centered content container.

### Customer storefront

| Route | Type / archetype | Goal / primary action | Current geometry and typography | Responsive, composition, accessibility, and state issues | Action required | QA |
|---|---|---|---|---|---|---|
| `/` | Editorial storefront (A) | Understand the brand and enter the collection / **Shop collection** | Legacy `hero` and `catalog-main`; custom full-width sections; editorial display heading plus mono eyebrow | Header, hero, catalog, and story lack one axis. Excess hero whitespace; very small logo; story uses inline styling. Mobile section rhythm and focus order need verification. | Recompose around shared storefront container, intentional hero proportions, aligned editorial sections, and clear first CTA. | **FAIL** |
| `/products` | Product browsing (B) | Scan/filter merchandise / **Open product** | Custom/edge layout; four columns desktop, two mobile; heading and grid start at viewport edge | Confirmed no gutter at 1440 or 390. Mobile cards are too dense; toolbar fragments across rows; descriptions create noise; hit areas and card semantics need review. Error path currently surfaces server logging but lacks a composed recovery state. | Build browse shell, toolbar, responsive 1/2/3/4-column rules, concise cards, and contextual error/empty states. | **FAIL** |
| `/categories/[slug]` | Product browsing (B) | Browse one collection / **Open product** | Shares catalog/query components and legacy catalog geometry | Inherits catalog axis, density, card, and database-failure state issues; dynamic title/empty result composition requires browser coverage. | Reuse corrected browse shell and add collection-specific heading/empty copy. | **NEEDS WORK** |
| `/products/[slug]` | Product purchase (C) | Evaluate size/stock and buy / **Add to bag** | Outer `max-w-7xl px-4`, inner `max-w-6xl`; `lg` 3/5 gallery + 2/5 rail; large rounded bordered gallery; mono metadata | Confirmed gallery/breadcrumb at edge and mismatched axes. Mobile image consumes first viewport and defers buying controls; purchase rail is visually detached desktop. Size guide/disability/error states need full overlay QA. | Create PDP grid with balanced media/rail, shared axis, visible purchase decision block, sticky behavior only where safe, and responsive gallery. | **FAIL** |
| `/cart` | Transaction (D) | Review bag and continue / **Checkout or sign in** | Authenticated `max-w-7xl`; signed-out `min-h-screen` centered Card; variable gutters | Confirmed huge mobile dead space and edge-touching signed-out card. Empty, signed-out, and populated layouts do not share a stable page header/context. | Top-align state within transaction shell; maintain summary context; verify quantity/delete focus, stock errors, and mobile CTA behavior. | **FAIL** |
| `/checkout` | Transaction (D) | Confirm address/payment and place order / **Place order** | `max-w-7xl mx-auto px-4 py-8 md:py-12`; desktop 12-column Card layout | Uses a different axis from catalog/PDP; Card grouping may obscure completion order. Needs populated/invalid/submitting/GCash/COD visual inspection and persistent mobile summary review. | Define checkout step hierarchy, stable summary, inline validation, mutation feedback, and transaction-width rules. | **NEEDS WORK** |
| `/orders` | Customer self-service (F) | Find and track purchases / **Open order** | `max-w-5xl px-4`; card list; account-adjacent typography | Narrower/different axis; list density and status hierarchy need authenticated inspection. Loading exists, but empty/error/account-navigation context is inconsistent. | Move into account shell; create scanable order rows/cards with non-color status and contextual empty state. | **NEEDS WORK** |
| `/orders/[id]` | Customer self-service detail (F) | Understand status, payment, delivery / **Complete next required action** | `max-w-5xl`; multiple Cards and custom progress tracker | Progress, GCash evidence, fulfillment, totals, and delivery compete as separate panels. Mobile sequence and expired/rejected/failed states require inspection. | Establish order summary header, status timeline, one next-action panel, grouped money/delivery facts, and complete state matrix. | **NEEDS WORK** |

### Authentication and account

| Route | Type / archetype | Goal / primary action | Current geometry and typography | Responsive, composition, accessibility, and state issues | Action required | QA |
|---|---|---|---|---|---|---|
| `/login` | Auth (E) | Access account / **Sign in** | Split auth frame; form `max-w-sm` within about 1020px shell; display title + mono labels | Confirmed left-anchored desktop shell with dead right column; mobile has no reliable gutter, excessive top gap, compressed form rhythm. Separator and secondary links are weak. | Rebuild centered/auth split composition with consistent form spacing, clear OAuth/email hierarchy, error slot, and mobile-safe padding. | **FAIL** |
| `/signup` | Auth (E) | Create account / **Create account** | Reuses auth frame/form controls | Expected to inherit login geometry. Consent/password requirements, server error placement, success/confirmation state, and mobile keyboard flow need inspection. | Apply auth archetype and explicit requirements/status messaging. | **NEEDS WORK** |
| `/forgot-password` | Auth (E) | Request recovery / **Send recovery link** | Reuses auth styling | Inherits shell problems; success state and return path need visual QA. | Use compact auth task layout with persistent context and clear sent state. | **NEEDS WORK** |
| `/update-password` | Auth (E) | Set new credential / **Update password** | Reuses auth styling | Token-invalid, expired, mismatch, processing, and success states need composed feedback; inherits shell problems. | Add state-specific page copy and stable mutation feedback in auth shell. | **NEEDS WORK** |
| `/auth/confirm` | Auth route handler | Confirm auth token / redirect | Nonvisual endpoint | Safety and destination are functional concerns; no independent page to visually pass. Failure result is represented by `/auth/error`. | Verify redirect destinations and error copy during auth E2E QA. | **N/A endpoint** |
| `/auth/error` | Auth/system state (E/K) | Understand auth failure / **Retry or return** | Small auth/error Card using legacy auth classes | Risks generic error composition and weak recovery priority; mobile/long-message behavior unverified. | Normalize with auth shell and actionable, safe error language. | **NEEDS WORK** |
| `/account` | Customer self-service (F) | Manage profile / **Save changes** | `max-w-5xl px-4`; horizontal account navigation; Card form | No durable desktop account shell; save feedback, dirty state, validation, and account-level hierarchy need inspection. | Create account navigation/content shell and consistent section header/form/action bar. | **NEEDS WORK** |
| `/account/addresses` | Customer self-service (F) | Manage delivery addresses / **Add or save address** | `max-w-5xl`; Card list/forms; horizontal navigation | Add/edit/default/delete tasks compete; destructive confirmation and compact mobile form sequence need inspection. | Recompose address list + editor with clear default state, safe delete confirmation, and account shell. | **NEEDS WORK** |
| `/account/orders` | — | — | Route does not exist; canonical history is `/orders` | Navigation label/destination must not imply a missing child route. | Decide whether `/orders` remains canonical or becomes an account child; avoid duplicate implementations. | **N/A** |

### Admin and POS

| Route | Type / archetype | Goal / primary action | Current geometry and typography | Responsive, composition, accessibility, and state issues | Action required | QA |
|---|---|---|---|---|---|---|
| `/admin` | Admin overview (G) | Assess operations / **Open urgent queue** | Admin layout `p-4 md:p-8 xl:p-12`, inner `max-w-6xl`; many KPI/pipeline/link Cards | Too many equally weighted cards; operational exceptions are not dominant. Narrow max width wastes desktop canvas. Mobile priority order unverified. | Create exception-led overview with compact KPIs, queue summary, and restrained shortcuts. | **NEEDS WORK** |
| `/admin/orders` | Admin index (G) | Scan and process order queue / **Open order** | `max-w-6xl`; workspace/table/Card patterns; filters | Auth redirect verified, authenticated UI pending. Expected width constraint reduces columns and scanability; filters/status/actions need sticky and mobile patterns. | Build full-width operational queue, compact filter bar, row hierarchy, safe bulk/row actions, and responsive card rows. | **NEEDS WORK** |
| `/admin/orders/[id]` | Admin resource detail/workspace (H/I) | Fulfill order safely / **Advance valid status** | Multiple disconnected Cards inside admin max width | “Card soup” weakens chronology and next-action priority. Payment and fulfillment must remain distinct; destructive/irreversible transitions need confirmations and server-result feedback. | Build order command header, timeline, facts rail, transition guardrails, audit context, and mobile action hierarchy. | **NEEDS WORK** |
| `/admin/payments` | Admin index/workspace (G/I) | Review evidence and resolve queue / **Approve or reject safely** | Payment review workspace within `max-w-6xl`; Cards/dialogs | Evidence, order facts, amount, submission history, and action rationale need one review flow. Private receipt, zoom, loading, reject reason, expired submission, and double-action states need visual/security QA. | Create queue + focused review workspace with persistent facts, explicit decision controls, confirmation, and result state. | **NEEDS WORK** |
| `/admin/payments/receipts/[submissionId]` | Private route handler | Authorize and stream receipt | Nonvisual endpoint | Must never become a public asset URL. Error/expired/unauthorized results should be understandable in the review UI. | Security-test access and surface failures inside payment workspace. | **N/A endpoint** |
| `/admin/catalog` | Admin index/detail hybrid (G/H) | Manage merchandise / **Add or edit product** | Data table and dialogs inside Cards; `max-w-6xl` | Table-in-Card constrains useful width. Product/category/image/variant dialogs need dense but clear task separation; upload and mutation states need complete QA. | Use admin data canvas, responsive row/card pattern, and task-specific drawers/dialogs with validation and safe destructive actions. | **NEEDS WORK** |
| `/admin/users` | Admin index (G) | Manage staff/customer access / **Change authorized role/state** | Table inside Card, constrained admin container | Role/identity/security facts need stronger hierarchy; permission changes require explicit consequences, confirmation, and server authorization feedback. | Create access-management table with role explanation, guarded mutations, and audit linkage. | **NEEDS WORK** |
| `/admin/audit` | Admin index (G) | Investigate administrative changes / **Inspect event** | Table/filter UI inside constrained shell | Dense event fields need wider canvas, wrapping strategy, filter persistence, and mobile disclosure. Empty/error/export expectations unclear. | Build scanable audit table with time/actor/action/resource hierarchy and expandable details. | **NEEDS WORK** |
| `/admin/pos` | POS (J) | Build and complete counter sale / **Charge/complete sale** | Dedicated terminal component inside admin shell; loading screen exists | POS needs distinct speed/density rules, persistent basket/totals, keyboard/touch support, stock conflict recovery, and narrow-screen strategy. It must not inherit ordinary admin Card density. | Establish dedicated POS workspace with rapid search/variant selection, always-visible basket, guarded completion, and recovery states. | **NEEDS WORK** |
| `/admin-mfa` | Admin security/auth (E) | Complete MFA enrollment/challenge / **Verify** | Legacy auth classes and client form | Separate from modern auth/admin shells; recovery, invalid code, expiry, pending, enrollment, and mobile states need visual QA. | Create security-focused auth composition with clear step/state and no sensitive leakage. | **NEEDS WORK** |

## System state audit

| State | Current coverage | Issue | Required standard | QA |
|---|---|---|---|---|
| 404 | Global `not-found.tsx`, legacy auth-card styling | Visually detached from storefront; recovery destinations weak | Storefront shell, concise explanation, primary collection CTA, secondary home action | **NEEDS WORK** |
| Route error | Global and admin error boundaries | Error identity/recovery consistency unverified; correlation IDs should help support without alarming customers | Context-preserving boundary, retry where safe, correlation reference only when useful | **NEEDS WORK** |
| Loading | Dedicated skeletons for products, cart, orders, account, admin, catalog, payments, POS | Coverage and geometry vary; skeletons may not match final layout and can shift | Archetype-specific skeletons matching final axes and content footprint | **NEEDS WORK** |
| Empty | Per-page Cards/messages | Often removes page context or vertically centers the entire state | Preserve page title/navigation/filter context; explain why empty and offer one relevant next action | **FAIL** |
| Unauthenticated | Redirects and signed-out cart | Redirect works, but signed-out composition creates dead space; return destination copy is not visible | Contextual sign-in prompt, safe `next`, stable shell, clear guest/customer options | **FAIL** |
| Unauthorized | Server checks/redirects; visual state not fully inventoried | Redirect alone may hide why access is denied; must not expose protected data | Neutral denial, safe destination, logged server decision, no privilege hints | **NEEDS WORK** |
| Mutation pending/success/failure | Mix of inline state and toasts | Feedback may be transient or distant from action; double-submit and focus recovery require review | Disable/lock only affected action, persistent inline result for consequential mutations, focus/error summary | **NEEDS WORK** |
| Database unavailable | Catalog queries log correlation IDs | Current customer route can emit noisy console/server errors and lacks a polished recovery composition | Log once server-side; show customer-safe retry/empty distinction and retain navigation | **FAIL** |

## Modal and overlay inventory

| Surface | Routes | Audit focus | QA |
|---|---|---|---|
| Size guide dialog | PDP | Uses the supplied brand size-chart asset, readable zoom/scaling, focus trap/return, close target, mobile height and safe area | **NEEDS WORK** |
| Product/category/variant/image editors | Admin catalog | Form grouping, upload progress, validation, unsaved changes, destructive confirmation, focus management | **NEEDS WORK** |
| Payment approval/rejection | Admin payments | Evidence stays visible, amount/order identity persists, rejection reason required, decision confirmation, duplicate/expired handling | **NEEDS WORK** |
| Delete confirmations | Addresses/catalog and other resources | Name exact resource, distinguish reversible from irreversible, safe default focus, pending/error feedback | **NEEDS WORK** |
| Mobile navigation sheet/menu | Storefront/admin | 44px targets, current location, scroll locking, focus trap/return, collision with bag/support controls | **NEEDS WORK** |
| Dropdowns/selects | Filters, sizes, admin actions | Keyboard behavior, label association, long value wrapping, destructive action separation | **NEEDS WORK** |

## Target archetypes

| ID | Archetype | Density and composition rule |
|---|---|---|
| A | Editorial/storefront | Generous intentional negative space; strong brand moments; all content still lands on the shared storefront axis. |
| B | Product browsing | High scanability; compact controls; responsive card density; filters/results/search behave as one toolbar. |
| C | Product purchase | Media and purchase decision remain balanced; size, stock, price, guide, and CTA form one obvious task block. |
| D | Transaction | Narrower reading/action flow; totals and next action stay clear; no decorative dead space. |
| E | Auth | Centered compact task or balanced split; consistent 24px mobile gutter; errors and recovery paths remain near the relevant control. |
| F | Customer self-service | Stable account navigation, page heading, content region, and contextual actions; denser than editorial pages. |
| G | Admin index | Wide operational canvas, compact filters, scanable tables/rows, visible exception counts, minimal decorative Cards. |
| H | Admin resource detail | Command header + structured facts + history; related facts grouped without card fragmentation. |
| I | Admin operational workspace | Queue/context/action coexist; irreversible decisions retain evidence and clear confirmation. |
| J | POS | Fastest density, large touch targets, keyboard-friendly, persistent basket and totals, explicit completion/recovery. |

## Required shared layout contracts

These are design requirements for the remediation phase, not implementation decisions yet.

- **Storefront axis:** one reusable centered container, approximately 1440px maximum, with fluid gutters near `clamp(20px, 4vw, 64px)`. Header, breadcrumb, title, grids, PDP, cart, checkout, account, and footer align to it.
- **Reading/task width:** auth forms and focused transaction text use a deliberate inner width, centered inside the storefront axis rather than left anchored.
- **Account shell:** desktop navigation rail or compact section navigation plus content; mobile selector/tabs that do not overflow.
- **Admin canvas:** wider than `max-w-6xl` for tables and workspaces, with predictable page header, filter/action bar, main content, and contextual side region when needed.
- **Spacing rhythm:** page top, heading-to-content, section-to-section, card padding, form rows, and action groups receive named roles. Spacing must express hierarchy rather than merely use valid Tailwind tokens.
- **State grammar:** each archetype owns matching loading, empty, error, unauthenticated, unauthorized, and mutation states.

## Remediation order

1. Define global tokens and the storefront/admin/account container contracts.
2. Correct global header, mobile navigation, footer, floating-control collision rules, and system-state primitives.
3. Rebuild Auth because it currently demonstrates the clearest spacing failure and gates account/admin QA.
4. Rebuild product browse and PDP around the shared alignment system and mobile purchase priority.
5. Rebuild Cart/Checkout/GCash and order-detail transaction states.
6. Build the customer account shell, then profile, addresses, orders, and tracking.
7. Build the admin shell and page-header/filter/table patterns.
8. Prioritize admin Orders and Payments workflows, including guarded decisions and all queue states.
9. Apply admin patterns to Dashboard, Catalog, Users, Audit, and MFA.
10. Build the dedicated POS workspace.
11. Perform the full visual QA matrix: 390×844, 430×932, 768×1024, 1024×768, 1440×900, and 1920×1080; include populated, empty, loading, error, unauthenticated, unauthorized, pending, success, and failure states as applicable.
12. Only after verified browser inspection may an individual route move to **PASS** and the final `docs/UI_REFINEMENT_REPORT.md` be produced.

## Immediate acceptance gate

No implementation phase is complete merely because typecheck, lint, tests, or build pass. A route may move to **PASS** only when:

1. its primary user goal and primary action are visually obvious;
2. its archetype layout and alignment contract are used;
3. desktop and mobile composition have been inspected in a real browser;
4. loading, empty, error, and relevant authorization/mutation states have been inspected;
5. keyboard focus, labels, target sizes, contrast, and non-color status cues have been checked;
6. no private payment evidence, unsafe redirect, unauthorized action, or client-authoritative commerce state is introduced.

## Phase 2 foundation implementation — 2026-09-19

Status: **FOUNDATION FIXED / PAGE REFINEMENT PENDING**

The original findings above remain the audit baseline. Phase 2 corrected the shared geometry and runtime reliability defects without promoting any individual route to `PASS`.

### Layout contracts implemented

| Primitive | Contract | Routes/surfaces migrated |
|---|---|---|
| `store-container` + `store-page` | 1440px maximum; stepped 16/20/24/32/40/48px gutters | Products, categories, PDP, shared customer header, footer, and storefront loading state |
| `store-narrow-container` | 512px readable content maximum | Small system/auth states including 404 and MFA content |
| `auth-shell-container` | 1152px balanced split shell; form column remains narrow | Login, signup, recovery, and auth error through `AuthFrame` |
| `transaction-container` | 1280px maximum; top-biased; existing 12-column transaction grids retained | Signed-out/populated cart, checkout, cart loading |
| `account-container` | 1240px maximum with one shared customer self-service axis | Profile, addresses, password, order history/detail, and matching loading states |
| `admin-shell-container` | Up to 1600px after the persistent 256px sidebar | Dashboard, Orders, Payments, Catalog, Users, Audit, and POS through the admin layout |
| POS internal grid | Existing 7/5 at large and 8/4 at extra-large | POS catalog/current-sale workspace; now allowed to use the full admin work area |

### Runtime reliability corrected

- Removed the unlayered universal margin/padding reset that overrode Tailwind v4 utilities. This was the primary cause of missing `mx-*`, `px-*`, `py-*`, and other spacing throughout the application.
- Replaced the runtime Google Fonts stylesheet import with `next/font` Geist and Geist Mono self-hosting.
- Removed conflicting responsive logo dimensions that caused Next Image aspect-ratio warnings.
- Marked only the initial above-the-fold catalog images as priority candidates; the remainder stay deferred by Next Image.
- No CSP relaxation was introduced.

### Foundation browser verification

| Viewport | Representative route | Result |
|---|---|---|
| 390×844 | Login, Products | 20px customer gutter; auth begins near the top; no edge-touching fields or horizontal overflow |
| 768×1024 | Products | Header/title/filters/grid share the same axis; intentional three-column tablet grid |
| 1024×768 | PDP | Breadcrumb/gallery/purchase rail share the header axis; purchase grid uses available landscape width |
| 1366×768 | Home | Header and storefront maximum-width system is active; hero composition remains page-refinement scope |
| 1440×900 | Login, Products | Auth shell centered and balanced; catalog gutters and four-column grid restored |
| 1680×900 | Signed-out Cart | Transaction state is top-biased and no longer viewport-centered; footer aligns to the storefront axis |
| 1920×1080 | PDP | 1440px storefront canvas is centered with 48px internal gutters; no accidental right-side blank column |

`/checkout`, `/account`, `/admin`, `/admin/orders`, `/admin/payments`, and `/admin/pos` retain their real authentication/AAL2 boundaries. Their signed-out redirects were checked; authenticated screenshot approval remains pending an available seeded customer/admin session. No fake authentication state was created.

### Required validation

- `npm run typecheck`: PASS
- `npm run lint`: PASS
- `npm test`: PASS — 53/53
- Production build: intentionally not run; the phase did not require it and the development server remained active.

## Phase 3A — Authentication refinement — 2026-09-19

### IMPLEMENTED

- Rebalanced the 1152px desktop shell to approximately 46% interaction / 54% editorial content.
- Reduced the desktop shell from an oversized 44rem minimum to a calmer 40rem composition.
- Kept the form as the first and dominant task while reducing the decorative headline width and artwork competition.
- Removed the bordered-card treatment from mobile while retaining the composed shell from `sm` upward.
- Expanded short-phone form width to the established customer gutter instead of applying a second layer of internal padding.
- Kept the brand panel hidden on mobile so it cannot delay authentication.
- Preserved safe `next` values for both email and Google sign-in actions.
- Reused the accessible show/hide password control for the password-update form.

### VISUAL QA

Inspected `/login` with `/account`, `/cart`, and `/checkout` redirect variants, plus `/signup`, `/forgot-password`, and `/auth/error`. Checked 375×667, 390×844, 430×932, 768×1024, 1024×768, 1366×768, 1440×900, 1680×900, and 1920×1080 responsive behavior. At 375×667 the heading, Google action, both fields, and primary Sign In action are discoverable within the initial task area without decorative content preceding them.

Screenshot evidence:

- `docs/ui-screenshots/phase-3/auth-before-mobile.png`
- `docs/ui-screenshots/phase-3/auth-after-mobile.png`
- `docs/ui-screenshots/phase-3/auth-before-desktop.png`
- `docs/ui-screenshots/phase-3/auth-after-desktop.png`

### REMAINING ISSUE

Actual pending/disabled feedback during server-action submission depends on a dedicated client pending control and remains a functional enhancement. Authentication behavior and authorization boundaries were not changed.

### STATUS

**VISUAL PASS** for unauthenticated Auth compositions. Authenticated password-update outcome remains **FUNCTIONAL QA PENDING — AUTH SESSION REQUIRED**.

## Phase 3B — Product browsing refinement — 2026-09-19

### IMPLEMENTED

- Changed the catalog to one column below 375px, two columns from 375px, three on tablet, and four on desktop/wide screens.
- Converted category controls to a single touch-friendly, horizontally scrollable 44px row instead of multi-line tiny pills.
- Added the existing backend sort modes to the visible interface without adding unsupported filters.
- Kept search and sort compact on desktop and stacked them clearly on mobile.
- Removed secondary descriptions from the narrowest cards to protect name/price scanability.
- Corrected responsive image `sizes`; only the first four genuine above-the-fold desktop candidates use priority.
- Rebuilt `/categories/[slug]` with the same photography-led, border-light cards as `/products`, removing its previous dashboard-style Cards and listing CTAs.

### VISUAL QA

Inspected `/products` at 360, 375, 390, 430, 768, 1024, 1366, 1440, 1680, and 1920 widths, plus the category browsing composition. At 360px cards are readable in one column; at 390px two-column cards retain clear product names and prices. Desktop preserves four useful columns without shrinking photography.

Screenshot evidence:

- `docs/ui-screenshots/phase-3/products-before-mobile.png`
- `docs/ui-screenshots/phase-3/products-after-mobile.png`
- `docs/ui-screenshots/phase-3/products-before-desktop.png`
- `docs/ui-screenshots/phase-3/products-after-desktop.png`

### REMAINING ISSUE

The backend exposes category and price sorting but no additional product facets; no speculative filter drawer was added. Database-unavailable recovery remains part of the later system-state pass.

### STATUS

**VISUAL PASS** for populated product and category browsing. Database error-state refinement remains **NEEDS WORK**.

## Phase 3C — Product detail refinement — 2026-09-19

### IMPLEMENTED

- Placed product identity and price before media on mobile so the shopper immediately understands the item.
- Reduced the first mobile media footprint from square to 5:4 while keeping the complete garment composition useful.
- Kept genuine additional images as a desktop thumbnail gallery; no duplicate or generated product imagery was introduced.
- Preserved the desktop gallery/purchase split while strengthening title, price, description, size, availability, and CTA sequence.
- Reduced customer-facing monospace usage across price, size labels, controls, availability, CTA, delivery, and payment copy. SKU and archival eyebrow remain intentionally mono.
- Reorganized four equally weighted technical rows into “Product details” and “Delivery & payment” groups.
- Kept visible 44px size buttons and the adjacent Size Guide trigger.

### VISUAL QA

Inspected `/products/1968-classic` across the Phase 3 viewport matrix. At 390×844, product name, price, useful media, description, and the start of size selection are discoverable in the initial viewport; purchase controls no longer follow an unnecessary thumbnail block.

Screenshot evidence:

- `docs/ui-screenshots/phase-3/pdp-before-mobile.png`
- `docs/ui-screenshots/phase-3/pdp-after-mobile.png`
- `docs/ui-screenshots/phase-3/pdp-before-desktop.png`
- `docs/ui-screenshots/phase-3/pdp-after-desktop.png`

### REMAINING ISSUE

Inventory data currently exposes active variants but not an unavailable option matrix to this component, so unavailable-size styling cannot be honestly demonstrated without a real unavailable variant state.

### STATUS

**VISUAL PASS** for the populated benchmark PDP. Add-to-cart outcome remains **FUNCTIONAL QA PENDING — AUTH SESSION REQUIRED**.

## Phase 3D — Cart refinement — 2026-09-19

### IMPLEMENTED

- Replaced the heavy signed-out Card with a quiet commerce state inside the TransactionContainer.
- Changed the hierarchy to “Your bag is waiting” → accurate sign-in explanation → primary Sign In → secondary Continue shopping.
- Removed the unsupported claim that unauthenticated products are reserved.
- Preserved the safe `/login?next=/cart` return path.
- Retained the existing populated-cart item/summary architecture without changing money, quantity, inventory, or checkout behavior.

### VISUAL QA

Inspected the signed-out Cart across the Phase 3 viewport matrix. The state is top-biased, concise, free of nested-card decoration, and keeps both recovery actions visible on mobile.

Screenshot evidence:

- `docs/ui-screenshots/phase-3/cart-before-mobile.png`
- `docs/ui-screenshots/phase-3/cart-after-mobile.png`
- `docs/ui-screenshots/phase-3/cart-before-desktop.png`
- `docs/ui-screenshots/phase-3/cart-after-desktop.png`

### REMAINING ISSUE

Populated item editing, quantity feedback, stock conflict handling, and summary behavior could not be visually exercised without a legitimate customer session.

### STATUS

Signed-out state: **VISUAL PASS**. Populated cart: **FUNCTIONAL QA PENDING — AUTH SESSION REQUIRED**.

## Phase 3E — Checkout review — 2026-09-19

### IMPLEMENTED

- Confirmed the existing TransactionContainer uses the intended 60–65% form / 35–40% summary structure and a single-column mobile order.
- Kept address selection explicit, labelled, and server-authoritative.
- Kept item, subtotal, shipping, and total visible in the summary with an accurate “Place Order” action.
- Corrected Manual GCash wording so receipt submission is described as manual verification, never immediate or automatic settlement.
- Moved desktop summary stickiness below the persistent customer header (`top-24`) and disabled sticky behavior on mobile.
- Preserved checkout RPC, idempotency, inventory reservation, payment state, RLS, and authorization behavior.

### VISUAL QA

The unauthenticated route behavior was verified: Checkout safely returns users without an eligible cart to the Cart flow. The populated Checkout screen cannot be honestly rendered without a legitimate authenticated customer, non-empty canonical cart, and saved address.

### REMAINING ISSUE

Populated address selection, submission errors, mobile summary order, and the complete GCash order transition require a legitimate customer browser session. The current checkout presents Manual GCash only; no unsupported COD selector was invented during this visual phase.

### STATUS

**FUNCTIONAL QA PENDING — AUTH SESSION REQUIRED**. Source-level hierarchy and payment-language review completed; no visual-pass claim made.

### Phase 3 batch validation

- `npm run typecheck`: PASS
- `npm run lint`: PASS
- `npm test`: PASS — 53/53
- `npm run build`: PASS after stopping the development server; Next.js 15.5.24 production compilation completed successfully.
- Development server restarted successfully at `http://localhost:3000` after the isolated build.
- Fresh public-route console inspection: no runtime errors or warnings.

---

## Phase 3.1 — Customer UX Correction Pass

**Date:** 2026-09-19

### Changes applied

| # | Surface | File | Change |
|---|---|---|---|
| 1 | Auth shell | `src/components/auth-frame.tsx` | Removed marketing aside; centered single-column card (max-w-512px), small logo mark above form on all viewports |
| 2 | Login error | `src/app/login/page.tsx` | Credentials error moved inline between password field and Sign In button; `role="alert"`, `aria-describedby`, `aria-invalid` |
| 3 | Signup errors | `src/app/signup/page.tsx` | Field-level inline errors routed by error key: email, password, profile, signup (server), oauth — each with icon + text |
| 4 | Products catalog | `src/app/products/page.tsx` | Fashion catalog redesign: SHOP eyebrow, 1968 Collection H1, category pills as Link elements, product count + sort above divider, clean 2/3/4-col grid, category name eyebrow on card, no description text, no hardcoded Drop 01 badge |
| 5 | PDP spacing | `src/app/products/[slug]/page.tsx` | Spacing system applied; eyebrow pulls category name from DB via `getCategories()`; price `text-2xl font-bold`; mobile header above gallery |
| 6 | PDP form spacing | `src/components/product-purchase-form.tsx` | SIZE label→buttons (space-y-3), buttons→stock (mt-5/20px), stock→Add to Bag (mt-6/24px) |
| 7 | Size guide | `src/components/size-chart-dialog.tsx` | Three sections: How to Measure (image illustration), HTML `<table>` with `<thead>`/`<tbody>`/`<th>` semantics, Fit Note. Mobile: max-height + overflow-y scroll, table overflow-x wrapper. Accessible: DialogTitle, DialogDescription, close button label, focus returns to trigger |
| 8 | Mobile nav | `src/components/mobile-nav.tsx` | Full-screen black overlay: logo + X close in header row, large 64px-touch-target links with active state + dot indicator, Escape key closes, focus management (first link on open, trigger on close), aria-modal, aria-hidden |
| 9 | Mobile nav CSS | `src/app/globals.css` | Updated `.mobile-nav-overlay` (full black, opacity transition), added `.mobile-nav-overlay-header`, `.mobile-nav-close`, `.mobile-nav-link.active`, `.mobile-nav-arrow`, `.mobile-nav-footer` |
| 10 | Demo users | `scripts/create-demo-users.mjs` | Node.js script creating `customer.demo@1968.local` and `admin.demo@1968.local` via Supabase Admin API. Idempotent. Guards against non-local URLs. |
| 11 | Demo docs | `docs/LOCAL_DEMO_ACCOUNTS.md` | Credentials table, setup steps, MFA enrollment steps for admin, QA route tables, reset instructions |

### Phase 3.1 batch validation

- `npm run typecheck`: **PASS**
- `npm run lint`: **PASS**
- `npm test`: **PASS — 53/53**
- Demo accounts verified via `npx supabase db query --local` — both rows confirmed with correct roles

### Known post-3.1 items

- Admin MFA enrollment must be done manually in-browser (cannot be scripted — correct per security rules)
- Browser QA screenshots pending dev server session
- `fix-demo-users.sql` scratch file can be removed once demo setup process is documented and stable

---

## Phase 3.2 — Authenticated Transaction and Admin Shell QA

**Date:** 2026-09-19

### Browser-verified customer journey

- Signed in with the documented local customer QA account.
- Verified Account Settings at 1440×900 and 390×844.
- Added a real database-backed product variant to the bag and verified the populated mobile cart.
- Verified checkout with the customer's saved default address and server-calculated ₱550.00 subtotal, ₱150.00 shipping, and ₱700.00 total.
- Placed local test order `ORD-20260919-7A59DF56E3` through the canonical checkout path.
- Attached the built-in QA receipt and submitted payment proof successfully.
- Verified customer feedback, immutable receipt history, private signed receipt link, and `SUBMITTED` payment state.

### Browser-verified staff journey

- Signed in with the documented local administrator QA account.
- Completed the legitimate local AAL2 authenticator flow; no authorization or MFA bypass was used.
- Verified the new submission appeared immediately in the dashboard audit activity and Payments queue.
- Verified expected/claimed amount comparison, missing-reference disclosure, receipt preview controls, and explicit approve/reject actions.

### Shared admin shell correction

- Removed storefront announcement, header, and footer chrome from `/admin/**` so the operations portal remains a distinct work surface.
- Corrected the admin logo contrast in light and dark modes.
- Reduced mobile shell padding and consolidated administrator identity/MFA badges into a compact row.
- Preserved horizontally scrollable 44px navigation targets for the full admin route set.

### Validation

- `npm run typecheck`: **PASS**
- `npm run lint`: **PASS**
- `npm test`: **PASS — 53/53**

### STATUS

Authenticated customer checkout and proof submission: **PASS**. Admin AAL2 entry and payment-queue visibility: **PASS**. Payment approval/rejection mutation and subsequent fulfillment transitions remain pending dedicated destructive-state QA.

---

## Forensic remediation implementation — 2026-09-20

### Correctness evidence

- Product edit now exposes and prefills Description. `saveProduct` distinguishes an explicitly empty description from an omitted field and reads the existing value before unrelated legacy edits. Regression coverage added.
- Variant editor and server action now share the canonical `active`, `inactive`, `archived` contract; invalid states are rejected before the RPC.
- Admin Catalog now exposes canonical product options, values, and variant-to-value mapping using the existing database RPCs. PDP continues to resolve the same mappings.
- Cart no longer owns a hardcoded delivery fee. Cart, Checkout display, and authoritative checkout submission use `calculateShippingMinor` with trusted fulfillment settings.
- Free delivery is active at `subtotal >= threshold`; tests cover threshold minus one, exact threshold, threshold plus one, and pickup.
- Automated gate: **65/65 tests PASS; typecheck PASS; lint PASS**.

### Responsive and media evidence

- Cart and PDP were measured in the running browser at 360×800, 390×844, 430×932, 768×1024, 820×1180, 1024×768, and 1440×900. Every measured document width remained within its viewport.
- Admin Catalog keeps disclosure cards through tablet/standard laptop widths and activates the dense table only at `xl`.
- Size Guide uses one 44px top close control, Radix focus trapping/Escape behavior, a scroll-safe `svh` container, z-index above the sticky storefront header, and a diagram-only SVG. Measurements remain a semantic HTML table.
- PDP gallery receives all ordered images. Mobile uses Embla swipe with count/discoverability copy; desktop has selectable thumbnails and selected state. Viewer includes previous/next, count, keyboard arrows, Escape via Dialog, and 1×–3× zoom.
- Product cards have a restrained border/media surface, reduced hover scale, pressed/focus feedback, and reduced-motion protection.

### Catalog, account, and storefront evidence

- Product media upload appends automatically; staff no longer enter display-order numbers. Existing primary/up/down/delete controls remain.
- Category editing now preserves description and exposes archive/reactivate with consequence copy.
- Account home now shows real active-order tracking, recent orders, and the real default delivery address only when relevant.
- Public footer no longer exposes Operations Portal. Collection links come from active database categories; brand copy, support email, and location are controlled by Store Settings.
- GCash checkout copy is neutral and no longer makes an unsupported “Verified Merchant” claim. Account details and QR asset path are managed together with a synchronization reminder.
- Desktop header uses balanced three-column geometry for true navigation centering.
- Removed the earlier duplicate footer CSS contract after browser-visible styling stabilized.

### Remaining destructive QA boundary

The media CRUD benchmark (temporary fourth-image upload, primary change, reorder, delete, and fixture restore) and admin setting mutation/restore require an authenticated AAL2 admin browser session. They were not simulated or bypassed. Code paths are present and automated authorization/RPC tests pass; complete these mutations during the dedicated local admin QA session.
