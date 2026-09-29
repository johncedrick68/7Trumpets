# 1968 V2 — Product Detail Page (PDP) Audit

## 1. Executive Summary
This audit evaluates the current PDP implementation at `src/app/products/[slug]/` against the live UA Worldwide retail shopping experience (`https://www.uaworldwide.com/products/*`) and the 1968 V2 storefront design system (zero-radius, black/white, minimal, product-first).

---

## 2. Component-by-Component Classification

| Component / Feature | Current Location | Classification | Action & Rationale |
|---|---|---|---|
| **PDP Server Page & Routing** | `src/app/products/[slug]/page.tsx` | **RESTRUCTURE** | Shift from stacked card layout to canonical UA 2-column desktop composition: Gallery left, Sticky Purchase Panel right (`sticky top-20`). Clean metadata. |
| **Product Breadcrumb** | `src/app/products/[slug]/page.tsx` | **RESTYLE** | Keep `Collection / [Product Name]` breadcrumb, refine to restrained `font-mono text-xs uppercase tracking-wider`. |
| **Product Title & Price** | `src/app/products/[slug]/page.tsx` | **RESTYLE** | Keep single `<h1>`, prominent bold grotesk title, and canonical `formatMinorUnitsToPHP(minPrice)` display directly beneath. |
| **Product Gallery** | `src/components/product-gallery.tsx` | **RESTYLE & RESTRUCTURE** | Remove all `rounded-xl`, `rounded-lg`, and pill badges. Convert to `rounded-none` borders. Maintain mobile carousel, desktop main image + thumbnail selector, and accessible fullscreen zoom viewer. |
| **Size / Variant Selector** | `src/components/product-purchase-form.tsx` | **RESTYLE** | Replace rounded pill buttons with crisp `rounded-none` boxes (`min-w-[48px] h-11`). Selected = solid black/white; unselected = light border; unavailable = strikethrough + disabled. Show active size label (`SIZE: S`). |
| **Size Guide Dialog** | `src/components/size-chart-dialog.tsx` | **RESTYLE** | Retain canonical measurements (`T_SHIRT_MEASUREMENTS`). Restyle modal to `rounded-none`, clean borders, and accessible table. Position trigger next to the Size legend. |
| **Quantity Stepper** | `src/components/product-purchase-form.tsx` | **RESTYLE** | Strict `rounded-none` container, `>=44px` touch targets for `[-]` and `[+]`, typed positive integer, disabled when out-of-stock. |
| **Add to Bag Action** | `src/components/product-purchase-form.tsx` | **RESTYLE** | Full-width, solid black (`bg-black text-white hover:bg-neutral-800`), `rounded-none`, `min-h-[48px]`. States: `ADD TO BAG · ₱X,XXX.00`, `ADDING…`, `SELECT SIZE`, `OUT OF STOCK`. |
| **Cart Mutation & Re-render** | `src/lib/cart/actions.ts` | **KEEP BEHAVIOR** | Server-authoritative inventory, guest & auth session reconciliation, cart count badge updates. |
| **In-Page Success Feedback** | `src/components/product-purchase-form.tsx` | **RESTYLE** | Clean restrained inline banner below Add to Bag button. Offers "View Bag" and "Continue Shopping". |
| **Validation Live Region** | `src/components/product-purchase-form.tsx` | **RESTYLE** | Keep accessible `role="alert"` live region with customer-safe error strings ("Please select a size to continue."). Remove generic rounded card styling. |
| **Commerce Assurances** | `src/app/products/[slug]/page.tsx` | **RESTRUCTURE** | Replace loose bulleted list with horizontal bordered assurance strip: Cash on Delivery, Manual GCash, Inventory Confirmed, Tracking Provided. |
| **Fabric & Care / Details** | `src/app/products/[slug]/page.tsx` | **RESTRUCTURE** | Display below purchase panel using flat dividers and section titles rather than dashboard cards. |
| **Customer Reviews** | N/A | **REMOVE / REJECT** | 1968 has no public review system. Zero star ratings, review counts, or buyer badges. |
| **Shopify Sticky Bar** | N/A | **REJECT** | Avoid intrusive mobile sticky bars that obscure form controls on short viewports. |

---

## 3. Preserved Domain & Security Invariants
- **Server-Authoritative Pricing**: Minor units (`centavos`) formatted via `formatMinorUnitsToPHP`.
- **Server-Authoritative Stock**: Quantities and variant availability enforced during server actions and database RPCs.
- **Accessible Focus Flow**: Tab sequence: Skip link &rarr; Header &rarr; Gallery &rarr; Size choices &rarr; Size Guide &rarr; Quantity &rarr; Add to Bag &rarr; Description.
- **Escape & Dialog Trapping**: Fullscreen image viewer and Size Guide modal trap focus and return focus cleanly on `Escape`.
- **Zero Automated Axe Violations**: Full accessibility across tested normal, variant selected, error, and dialog states.
