# 1968 Clothing — Design System Specification (DESIGN.md)

**Version:** 1.0.0  
**Brand:** 1968 Clothing (Filipino Streetwear · Est. 1968 · Manila)  
**System Architecture:** Next.js App Router + Tailwind CSS v4 + Shadcn UI Tokens  
**Authority:** Visual Source of Truth for all Customer Storefront & Operations Surfaces

---

## 1. Visual Theme & Philosophy

1968 Clothing is an independent Filipino streetwear label rooted in heritage, community, and the street culture of Manila. The digital experience reflects this aesthetic:

- **Contemporary Streetwear & Editorial Fashion**: Crisp, high-contrast, physical catalog feel.
- **Product-First Merchandising**: The garment photography provides the color, texture, and visual gravity. The interface chrome recedes to let the garment speak.
- **Black/White Led (Monochrome Foundation)**: True deep black, crisp white, and a disciplined neutral gray ramp. Emphasis is achieved via **contrast and inversion**, not arbitrary rainbow accents.
- **Minimal, but Never Empty**: Dense with product intent, clean alignment, and tactile feedback. Devoid of SaaS dashboard fluff, faux-modern glassmorphism, or gratuitous gradients.
- **Two Distinct Operating Densities**:
  - *Customer Storefront*: Editorial, photography-led, tactile, breathable.
  - *Admin Back-Office & POS*: Operational, dense, fast, data-rich (Webflow/Shopify inspired).

---

## 2. Brand Personality

| Trait | How It Manifests in the Interface |
| :--- | :--- |
| **Authentic** | Grounded typography, real studio photography, transparent pricing in integer centavos. |
| **Confident** | High-contrast black/white CTAs, bold display headlines, no timid gray-on-gray interactive text. |
| **Tactile** | Instant hover/active states, exposed size buttons (XS–XL), snappy 150ms feedback. |
| **Disciplined** | Strict mathematical spacing scale (4px/8px), restrained border radii, consistent 1px hairlines. |
| **Fast** | Zero full-page reloads, route-level instant loading skeletons, immediate cart interaction. |

---

## 3. Color Roles & Palette

The palette is strictly monochrome with purposeful semantic accents reserved exclusively for state signals (sale price, order success, critical alerts).

### Core Monochrome Ramp (Tailwind Semantic Tokens)

```css
:root {
  /* Canvas & Surfaces */
  --background: #ffffff;             /* Pure white main canvas */
  --foreground: #0a0a0a;             /* Pure black ink text */
  --card: #ffffff;                   /* Card surface */
  --card-foreground: #0a0a0a;
  --popover: #ffffff;                /* Dropdowns, modals, dialogs */
  --popover-foreground: #0a0a0a;

  /* Surfaces & Muted */
  --surface-muted: #f5f5f5;          /* Product image stage, utility bar, tag pills */
  --surface-hover: #ededed;          /* Micro-hover state */
  --muted: #f5f5f5;
  --muted-foreground: #666666;       /* Subtitles, secondary metadata */

  /* Primary Brand Action */
  --primary: #0a0a0a;                /* 1968 Primary CTA (deep black) */
  --primary-foreground: #ffffff;     /* Crisp white text */

  /* Secondary Action */
  --secondary: #f5f5f5;              /* Soft button / inactive chip */
  --secondary-foreground: #0a0a0a;

  /* Accents & Borders */
  --accent: #f5f5f5;
  --accent-foreground: #0a0a0a;
  --border: #e5e5e5;                 /* 1px hairline border */
  --border-strong: #d4d4d4;          /* Interactive borders */
  --input: #e5e5e5;                  /* Input outline */
  --ring: #0a0a0a;                   /* Accessible focus ring (2px solid black) */

  /* Semantic State Signals (Used Sparingly) */
  --destructive: #d30005;            /* Critical errors / sale price red */
  --destructive-foreground: #ffffff;
  --success: #16a34a;                /* In-stock tick, payment verified */
  --success-bg: #f0fdf4;
  --success-border: #bbf7d0;
  --warning: #d97706;                /* Low stock, pending review */
  --warning-bg: #fffbeb;
  --warning-border: #fed7aa;
}

.dark {
  --background: #0c0c0f;             /* Near-black canvas */
  --foreground: #f4f4f5;             /* Off-white ink text */
  --card: #141418;
  --card-foreground: #f4f4f5;
  --popover: #141418;
  --popover-foreground: #f4f4f5;
  --surface-muted: #1c1c21;
  --surface-hover: #26262c;
  --muted: #1c1c21;
  --muted-foreground: #a1a1aa;
  --primary: #f4f4f5;                /* Inverted high-contrast CTA in dark mode */
  --primary-foreground: #0c0c0f;
  --secondary: #1c1c21;
  --secondary-foreground: #f4f4f5;
  --accent: #1c1c21;
  --accent-foreground: #f4f4f5;
  --border: #27272a;
  --border-strong: #3f3f46;
  --input: #27272a;
  --ring: #f4f4f5;
}
```

---

## 4. Typography Hierarchy & Roles

Typography is deliberately split by role. Locally bundled **SF Pro Display** (Regular, Medium, and Bold through `next/font/local`) is used only for editorial display roles such as hero copy, major storefront headings, auth titles, account H1s, and prominent PDP titles. Forms, navigation, body copy, account controls, admin, tables, and POS use the robust system UI text stack: **`-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif`**. Native monospace remains reserved for archive drops, order codes, SKUs, timestamps, and compact operational metadata. No runtime font request is permitted.

### Type Roles

| Token Role | Element / Context | Size / Weight | Line Height | Tracking | Case |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`display-hero`** | Editorial Campaign Banner | 40–56px / 800 | 1.05 | -0.03em | Normal / Title |
| **`h1`** | Page Titles, PDP Title | 32–36px / 700 | 1.15 | -0.02em | Normal |
| **`h2`** | Section Headers, Drawer Title | 22–26px / 700 | 1.25 | -0.01em | Normal |
| **`h3`** | Card Titles, Modal Headers | 18–20px / 600 | 1.30 | 0 | Normal |
| **`title`** | Product Names in Grids/Lists | 15–16px / 600 | 1.35 | 0 | Normal |
| **`body-lg`** | Lead Paragraphs, Introductions | 16–18px / 400 | 1.60 | 0 | Normal |
| **`body`** | Standard Body Copy, Forms | 14–15px / 400 | 1.50 | 0 | Normal |
| **`body-sm`** | Helper Text, Footnotes | 13–14px / 400 | 1.45 | 0 | Normal |
| **`label`** | Form Labels, Field Descriptors | 13–14px / 500 | 1.20 | 0 | Normal |
| **`eyebrow`** | Drop tags, Category indicators | 11–12px / 700 | 1.20 | +0.12em | UPPERCASE (Mono) |
| **`money`** | Customer-facing prices, subtotals, shipping, totals | 14–20px / 600–700 | 1.20 | 0 | Normal (System UI Sans, tabular figures where useful) |
| **`mono-meta`** | SKU, Order #, Tracking #, GCash reference, timestamps, audit/technical metadata | 12–14px / 600 | 1.20 | 0 | Normal (Mono) |

*Rules:*
- Never use heavy 800/900 weights for ordinary labels or descriptions.
- Uppercase text is strictly reserved for `eyebrow` and `mono-meta` badges.
- Body paragraphs must use regular weights (400) for effortless legibility.

---

## 5. Strict Spacing Scale & Rhythm

**Never eyeball arbitrary pixel margins.** All paddings, gaps, and margins must snap to this base scale:

`2px` · `4px` · `8px` · `12px` · `16px` · `20px` · `24px` · `32px` · `40px` · `48px` · `64px` · `80px` · `96px`

### Working Rhythms

- **`8px` (Micro)**: Gap between label and input, gap between product title and price, tag inner padding.
- **`12px` (Tight)**: Spacing inside compact cards, table cell padding, dropdown item padding.
- **`16px` (Standard)**: Spacing between form fields, default card padding on mobile, button horizontal padding.
- **`24px` (Group)**: Spacing between logical form groups, checkout section spacing, grid gutters.
- **`32px` (Section Split)**: Spacing between major component blocks, modal internal padding.
- **`48px` (Page Sub-Section)**: Vertical breathing between catalog filter bar and grid.
- **`64px` (Major Section)**: Vertical separation between storefront campaign rows.

### Form Spatial Rhythm Contract

```
Label
  ↓ (6–8px)
Control (Input / Select) [Height: 48–52px]
  ↓ (6–8px)
Helper / Error Text
  ↓ (16–20px)
Next Field Group
  ↓ (24–32px)
Primary Form CTA
```

---

## 6. Page Gutters & Container Grid

| Viewport Width | Side Gutter (`px`) | Grid Behavior | Max Content Measure |
| :--- | :--- | :--- | :--- |
| **< 375px** | 16px | 1 col (Checkout / Forms), 2 col (Product Grid) | Full width |
| **375–479px** | 20px | 1 col (Forms), 2 col (Product Grid) | Full width |
| **480–767px** | 24px | 2 col (Product Grid / Lists) | Full width |
| **768–1023px (Tablet)** | 24–32px | 2–3 col (Product Grid), 12-col layout | 768–960px |
| **1024–1439px (Desktop)**| 32–40px | 3–4 col (Product Grid), 60/40 PDP & Checkout | 1200–1280px |
| **≥ 1440px (Wide)** | 48px | 4 col (Product Grid), constrained measure | 1360px max |

*Rules:*
- Storefront maximum width is capped at `1360px` to prevent ultra-wide distortion.
- Reading and transactional forms are constrained to `max-w-md` (448px) or `max-w-lg` (512px) — never stretch a form simply because horizontal space exists.

---

## 7. Component Geometry & Border Radius

We enforce a restrained radius vocabulary:

- **`4px` (`rounded-xs`)**: Micro tags, SKU badges, keyboard `<kbd>` indicators.
- **`8px` (`rounded-md`)**: Inputs, select menus, standard utility buttons, table rows.
- **`12px` (`rounded-lg`)**: Small cards, operational panels, drawer content containers.
- **`16px` (`rounded-xl`)**: Primary customer cards (PDP purchase box, checkout summary, order cards, modals).
- **`9999px` (`rounded-full`)**: Primary action pills, filter chips, circular icon buttons, swatch dots.

*Strict Prohibition:* Do not apply `rounded-2xl` (24px) or `rounded-3xl` (32px) to rectangular content cards or operational tables.

---

## 8. Elevation & Shadows

The default aesthetic is **flat and tactile**. Hierarchy is generated through contrast, hairline borders, and surface tones.

- **Level 0 (Default / Flat)**: `0px` shadow. Forms, operational panels, and tables use restrained hairlines where structure requires them. Product text areas remain unboxed; only their media stage may carry a subtle hairline.
- **Level 1 (Hover Contact)**: Product media may strengthen its hairline on true mouse hover; do not add a generic dashboard-card shadow.
- **Level 2 (Floating Controls / Mobile Sticky Bar)**: `0 4px 16px rgba(0, 0, 0, 0.08)`. Sticky bottom Add-to-Bag bar, active dropdown popover.
- **Level 3 (Modal / Drawer Backdrop)**: `0 20px 48px rgba(0, 0, 0, 0.18)`. Operational sheets and confirmation dialogs.

---

## 9. Buttons & Interactive States

Every button must implement complete interactive state coverage:

### 1. Primary Button (`button-primary`) — The Universal 1968 CTA
- **Background**: `#0a0a0a` (Pure Black)
- **Text**: `#ffffff` (Pure White)
- **Height**: 48px (Customer Storefront) / 40px (Admin Back-Office)
- **Typography**: 14–15px / 600 weight
- **Hover**: Background shifts to `#262626` (Opacity 90%), subtle `-1px` transform
- **Active / Pressed**: `scale(0.98)`, Background `#333333`
- **Focus-Visible**: `outline: 2px solid var(--ring)`, `ring-offset-2`
- **Disabled**: Background `#e5e5e5`, text `#a3a3a3`, cursor `not-allowed`

### 2. Secondary Button (`button-secondary`)
- **Background**: `#ffffff`, **Border**: `1px solid #d4d4d4`, **Text**: `#0a0a0a`
- **Hover**: Background `#f5f5f5`, border `#0a0a0a`

### 3. Ghost / Icon Button (`button-icon`)
- **Size**: Minimum 44x44px touch target on mobile
- **Hover**: Background `#f5f5f5`

---

## 10. Product Cards & Merchandising (PLP)

Inspired by Nike fashion merchandising:

```
┌──────────────────────────────────────────┐
│                                          │
│   [ FULL-BLEED GARMENT PHOTOGRAPHY ]    │
│   Aspect Ratio: 1:1 or 4:5               │
│   Background: #f5f5f5                    │
│                                          │
│   [Promo Badge: "NEW DROP" (Top-Left)]   │
└──────────────────────────────────────────┘
  ↓ (8px gap)
  Product Title (15px / 600 weight)
  ↓ (4px gap)
  Subtitle / Colorway ("Black / Vintage Wash" — 13px / 400 muted)
  ↓ (6px gap)
  Price ("₱1,850.00" — 14px / 600 System UI Sans, tabular figures)
```

*Rules:*
- **No Boxed Outer Card**: The photograph is the merchandising surface. Do not enclose the combined media and metadata inside a bordered dashboard box or add a generic card shadow. The text/metadata area remains borderless.
- **Media Stage**: Product media may use a subtle 1px hairline, soft neutral stage, and restrained radius. On devices with true mouse hover, strengthen the border without introducing unnecessary movement. Provide a clear focus-visible ring, tactile touch press feedback, and reduced-motion-safe transitions.
- **Role-Based Image Fit**: `PACKSHOT` media uses `object-fit: contain` where necessary to preserve the full garment or design. `EDITORIAL` and `LIFESTYLE` media may use intentional `object-fit: cover`. Never stretch or distort an image; its media role determines treatment.

---

## 11. Product Detail Page (PDP) Architecture

Inspired by Meta hardware commerce and Baymard apparel standards:

- **Desktop (≥ 1024px)**:
  - **Left (~60%)**: Multi-angle garment photo gallery with clean vertical rhythm.
  - **Right (~40%)**: Sticky purchase rail.
- **Purchase Rail Hierarchy**:
  1. Eyebrow Category / Drop Code (`ARCHIVE DROP 01`)
  2. Garment Title (`h1`, 28–32px font-extrabold)
  3. Authoritative Centavo Price (`₱X,XXX.XX`, system UI sans 20px with tabular figures)
  4. Divider Hairline
  5. **Size Header**: Label ("Select Size") + **Inline "Size Guide" button directly adjacent**
  6. **Tactile Size Buttons**: Exposed XS, S, M, L, XL chips. Available sizes have solid 1px border; selected size inverts to black background; out-of-stock sizes have strikethrough and disabled state.
  7. **Stock Level Indicator**: Real-time availability indicator ("Only 2 left" in warning amber when stock ≤ 3).
  8. **Primary CTA**: Full-width 52px Black Pill: `ADD TO BAG`.
  9. Fulfillment & Trust Accordions: Shipping facts (Free shipping over `{freeShippingThreshold}`), COD availability, Manual GCash verification. The threshold comes from authoritative Store Settings data.
- **Mobile (< 1024px)**:
  - Full-width swipeable image gallery.
  - Purchase information immediately below.
  - **Sticky Bottom Action Bar**: Elevated bar pinned to mobile viewport bottom with Price + "Add to Bag" button for instant conversion without scrolling.

---

## 12. Cart & Bag Experience

- **Clarity Over Chrome**: Remove nested boxes and heavy borders.
- **Line Items**: High-res garment thumbnail (72x72px), garment title, selected size pill, unit price, quantity stepper (`-` / `+`), and delete icon.
- **Free Shipping Meter**: Prominent progress strip indicating distance to the configured `{freeShippingThreshold}`. Customer UI reads the authoritative Store Settings value; Cart and Checkout use the same server-authoritative rule.
- **Summary Sticky Rail**: Subtotal, calculated shipping, and total in prominent system UI sans with tabular figures, plus one dominant `PROCEED TO CHECKOUT` CTA.

---

## 13. Checkout Experience

- **Quiet & Trustworthy**: Header stripped of marketing links and banners.
- **Desktop (≥ 1024px)**: 60/40 Split (Customer, Address, and Payment method on left; Sticky Order Snapshot on right).
- **Payment Method Selection**: Plainly explained options:
  - `Cash on Delivery (COD)`: Clear notice of cash payment to courier upon arrival.
  - `Manual GCash Verification`: Clear notice of reservation timer, merchant QR scan, and receipt upload.

---

## 14. GCash Payment Experience

Preserves the database-authoritative reservation and verification state machine:

- **Order Header**: Order #, exact centavo total, and **Live Countdown Timer** synced with PostgreSQL reservation expiration.
- **Merchant Presentation**: Render `merchantName`, `merchantNumber`, `qrAsset`, `paymentWindow`, and `instructions` from authoritative Store Settings. This specification defines presentation only and does not define or replace real merchant configuration.
- **Mobile Single-Device Accommodation**:
  - `Save QR to Photos` (one-click download)
  - `Copy Number` (one-click clipboard copy)
  - Guidance on GCash's native "Upload from Gallery" scan flow.
- **Receipt Proof Upload**:
  - Drag-and-drop zone with client preview thumbnail, file size validation (≤ 5MB), and replace/remove buttons.
  - Reference number input with character counter.
- **Clear Verification Timeline**:
  `Order Created` → `Awaiting Payment` → `Proof Submitted` → `Verifying Payment` → `Payment Confirmed` → `Preparing Order` → `Shipped` → `Delivered`.
  *Never mark an order as PAID upon mere upload; display "Submitted for Verification".*

---

## 15. Authentication Screens (/login, /signup, /forgot-password)

- **Layout Structure**:
  - Pinned header with brand logo.
  - `main flex-1 min-h-[100svh]` container.
  - Form is strictly **order-first** and visible above the mobile fold on a 375x667 screen.
  - On mobile, dark marketing artwork is omitted or pushed cleanly below the fold with at least 48px vertical margin to **completely prevent overlap with "Create an account"**.
  - Footer remains in normal document flow. Scrolling is always preferred over visual collision.
- **Sign In CTA**:
  - Solid black `#0a0a0a` button with crisp white `#ffffff` text, 48px height, unmistakable primary hierarchy.

---

## 16. Customer Account Shell

- **Unified Navigation**: Reusable tab bar across `/account`, `/orders`, `/account/addresses`, `/update-password`.
- **Touch-Friendly**: Minimum 44px tab height with `aria-current="page"` and active background elevation.
- **Consistent Headers**: Standardized title and description without redundant repetitive banners.

---

## 17. Admin Back-Office (Webflow / Shopify Density Mode)

The Admin section shares core tokens with the storefront, but operates in a **high-density operational mode**:

- **Spacing**: 8px micro controls, 12px table cell padding, 16px card padding, 24px section separation.
- **Typography**: Compact headings (20–24px), dense tables (13px text), monospace uppercase badges (11px).
- **Navigation**: Persistent left sidebar with active route indicator and staff role badge.
- **Orders Workspace**: Instant search, status filter tabs, sortable table, and an operational **side drawer (`Sheet`)** to inspect complete customer and item facts without navigating away from the queue.

---

## 18. Admin POS Terminal (/admin/pos)

Optimized for rapid in-store counter operations:

- **Left Pane (Catalog & Fast Search)**: Instant filter by categories, keyboard shortcut (`/` to focus search), stock indicator badges, and one-tap size/variant selection pills.
- **Right Pane (Current Sale Register)**: Persistent cart list, quantity steppers, item removal, cashier badge (`Staff: {email}`), customer name/phone inputs, order remarks, and payment selector (Cash on Counter / GCash).
- **Transactional Safety**: Uses the canonical `processAdminPosSale` server action (AAL2 verified, transactional `checkout_order` RPC with ₱0 shipping, immediate cash settlement).

---

## 19. Admin Payment Review Workspace (/admin/payments)

Split-pane verification architecture:

- **Left Pane (Review Queue)**: Searchable list of pending and expired submissions with claimed amounts and timestamps.
- **Right Pane (Verification Desk)**:
  - Expected order amount vs Claimed amount vs Reference number side-by-side with discrepancy warnings.
  - **Large Receipt Previewer** with interactive zoom-in, zoom-out, and 90-degree rotation.
  - **Explicit Confirmation Dialogs**: Modals for Approve (`PAID`), Reject (with mandatory reason), and Expire.

---

## 20. Motion & Animation Standards

- **Duration**:
  - Micro-feedback (buttons, checkboxes, toggles): `100–150ms`.
  - Dropdown, popover, sheet reveal: `200–250ms` ease-out.
  - Route navigation: `0ms` (Instant — page navigation must NEVER wait for decorative animations).
- **Curves**: Smooth cubic-bezier (`cubic-bezier(0.16, 1, 0.3, 1)`). No bouncy physics.
- **Reduced Motion**: All animations immediately disable when `prefers-reduced-motion: reduce` is active.

---

## 21. Accessibility & Touch Contracts

- **Touch Targets**: All interactive elements (buttons, inputs, tabs, mobile menu toggles) must meet or exceed `44x44px` on touch viewports.
- **Visible Focus**: All interactive controls define `:focus-visible` with a high-contrast 2px solid ring.
- **Screen Reader Semantics**:
  - `aria-label` on all icon-only buttons.
  - `aria-expanded` and `aria-controls` on mobile drawers and accordions.
  - `aria-live="polite"` on cart counts and search result indicators.
  - Accessible show/hide password toggle.

---

## 22. Strict Do / Don't Rules

### DO:
- **DO** let garment photography lead every customer-facing layout.
- **DO** use exact integer minor units (centavos) formatted cleanly as `₱X,XXX.XX`.
- **DO** expose apparel sizes as tactile button chips on the PDP.
- **DO** anchor the Size Guide directly beside the size selection controls.
- **DO** keep the primary CTA unmistakably black on white (or white on black in dark mode).
- **DO** preserve instant Next.js `Link` routing and route-level `loading.tsx` skeletons.
- **DO** verify all layout and spacing changes visually in the browser across 375px, 768px, and 1440px.

### DO NOT:
- **DO NOT** use generic SaaS blue, purple, or green brand accents.
- **DO NOT** use heavy drop shadows (`shadow-xl`) on content cards.
- **DO NOT** enclose products inside boxed dashboard containers on the storefront.
- **DO NOT** hide apparel sizes in a `<select>` dropdown.
- **DO NOT** allow the auth footer or dark banner to collide with or overlap form controls on short viewports.
- **DO NOT** use `min-height: 100vh` without accounting for dynamic mobile address bars (use `100svh` or `100dvh`).
- **DO NOT** create artificial database states for visual wording.
