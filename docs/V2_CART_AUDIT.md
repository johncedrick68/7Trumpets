# 1968 V2 — Storefront Cart Audit & Architecture

**Document Version:** 1.0.0  
**Phase:** Phase 3 Storefront Cart Rebuild  
**Status:** Canonical Reference  

---

## 1. Executive Summary

This document establishes the audit and design specification for the 1968 V2 Storefront Cart (`/cart`). The objective is to combine UA Worldwide's retail simplicity, restrained visual character, and direct purchase path with 1968's verified server-authoritative cart architecture, database invariants, and zero-radius design language.

---

## 2. UA Worldwide Cart Patterns Studied

Live inspection of UA Worldwide (`https://www.uaworldwide.com/cart`) revealed key retail patterns:
- **Clean Hierarchy**:
  - Prominent page header: `Your cart`
  - Restrained secondary action: `Continue shopping` (linking directly to collection)
  - Left column: Linear list of cart items with generous apparel thumbnail footprint, variant identity, unit price, stepper quantity controls, and quiet ghost `Remove` action.
  - Right column: Sticky order summary with subtotal, factual disclosure that shipping is calculated at checkout, and full-width checkout CTA.
- **Empty State Simplicity**:
  - `Your cart is empty`
  - Direct `[ Continue shopping ]` CTA
  - Subtle account hint: `Have an account? Log in to check out faster.`
  - No bloated illustration cards, fake carousels, or aggressive popups.
- **Retail Micro-copy**:
  - Low copy density.
  - Zero unnecessary visual clutter or multi-step wizard cards.
  - Factual disclosures rather than unverified marketing promises.

---

## 3. Current 1968 Cart Classification

| Component / Feature | Current Implementation | Action | Rationale |
| :--- | :--- | :--- | :--- |
| **Data Fetching** | Server Component via `getOrCreateCart()` | **KEEP BEHAVIOR** | Maintains server authority, zero client layout shift, and immediate SSR rendering. |
| **Financial Authority** | Integer minor units (centavos) formatted via `formatMinorUnitsToPHP` | **KEEP BEHAVIOR** | Zero floating-point arithmetic. Subtotal calculated on server. |
| **Guest Cart Cookie** | Sanitized, tokenized, signature-safe cookie | **KEEP BEHAVIOR** | Preserves guest shopping experience with technical limits and replay safety. |
| **Reconciliation** | Replay-safe mutex & token tracking in `reconcileGuestCart` | **KEEP BEHAVIOR** | Concurrency-safe merge upon customer login with stock boundary checks. |
| **Stock Enforcement** | Server-side validation via `get_public_variant_availability` | **KEEP BEHAVIOR** | Untrusted browser never sets stock or bypasses inventory availability. |
| **Cart Item Card** | Rounded borders (`rounded-md`, `rounded-xl`), SKU display | **RESTYLE & TRIM** | Switch to `rounded-none`, remove internal SKU number (violates Section 10). |
| **Thumbnails** | Small 96px squarish container | **RESTRUCTURE** | Increase visual footprint to apparel `aspect-[4/5]` (~120–160px desktop, ~96–120px mobile). |
| **Quantity Stepper** | Accessible `[-] [ qty ] [+]` form submit buttons | **RESTYLE** | Zero-radius geometry, crisp borders, font-mono numbers, >=44px touch targets. |
| **Remove Action** | Icon-only trash button (`Trash2`) | **RESTYLE** | Switch to quiet text action (`Remove`) with >=44px accessible touch target. |
| **Empty Cart Card** | Dashed rounded card with circular icon and marketing copy | **RESTRUCTURE** | Replace with stark, minimal UA-inspired empty state and `Continue shopping` CTA. |
| **Order Summary** | Card with speculative delivery fee calculation | **RESTRUCTURE** | Align with Section 17 & 19: clean Subtotal + factual "Shipping calculated at checkout" disclosure. |
| **Authentication Prompt** | Generic box with sign-in link | **RESTYLE** | Restrained monospace prompt: `Have an account? Sign in to check out faster.` |
| **Checkout CTA** | Full-width black button | **RESTYLE** | Zero-radius, >=48px height, bold uppercase font-mono tracking. |
| **Error Feedback** | Alert banners for stock and update errors | **KEEP & REFINE** | Accessible `role="alert"` banners with customer-safe language (no backend leaks). |

---

## 4. Architectural Boundaries & Domain Invariants

1. **Server Authority**: The browser is untrusted. Prices, subtotals, item availability, and inventory boundaries are recomputed authoritatively by the server.
2. **Money Arithmetic**: Strictly minor integer units. Subtotal = $\sum (\text{unit\_price\_minor} \times \text{quantity})$ for all available items.
3. **Checkout Boundary**: The Checkout route (`/checkout`) remains guarded and frozen. Unauthenticated visitors are routed to `/login?next=/checkout`.
4. **Distinction of States (Error != Empty)**:
   - **Loading**: Zero-radius skeleton layout matching cart composition (`src/app/cart/loading.tsx`).
   - **Empty**: Populated when `cart.items.length === 0` under normal operation.
   - **Error**: Shown when `params.error` is present or database query fails; provides retry and return actions.
5. **No Visual Redesign of Frozen Work**: Admin, Shell, Header, Mobile Nav, Predictive Search, PDP, and Checkout remain strictly frozen.
