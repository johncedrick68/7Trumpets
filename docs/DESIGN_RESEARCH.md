# 1968 Clothing — Comprehensive Design Research & Synthesis

This document synthesizes findings from top-tier design systems (Apple, Airbnb, Meta, Webflow, Nike, Shopify), minimal/editorial design frameworks (Bryl Minimal, Taste Skill, UI/UX Pro Max), and authoritative external ecommerce research (Baymard Institute).

It establishes the foundational design rationale for **1968 Clothing** before any code modifications.

---

## 1. System-by-System Research Matrix

### Apple (`design-md/apple/`)
- **What We Learned**:
  - Uncompromising visual restraint: UI chrome recedes completely to let photography lead.
  - Alternating light/dark canvas rhythm acts as section separation without cluttering borders.
  - Extreme typographic discipline: Negative letter-spacing on display headlines (`-0.01em` to `-0.02em`) for the signature tight headline feel.
  - Zero decorative gradients; exactly one whisper-soft elevation shadow under physical product imagery.
  - Restrained interactive grammar: Single primary interactive color, compact pills, and clean utility rectangles.
- **What 1968 Will Use**:
  - Photographic focus: High-definition product imagery is the hero.
  - Quiet, invisible UI chrome on marketing and product display surfaces.
  - Subtle negative tracking on large display headings.
  - Flat default elevation; absence of artificial decorative gradients or heavy drop shadows.
- **What 1968 Will NOT Copy**:
  - Apple Action Blue (`#0066cc`) — 1968 is strictly monochrome/streetwear black-and-white led.
  - Giant full-viewport marketing storytelling on operational/transactional pages.
  - Unlicensed remote or runtime font acquisition. The project uses the user-provided local SF Pro Display resources through `next/font/local`, limited to display roles, with system UI text fallbacks for dense interface work.
- **Product Areas**:
  - Customer Storefront, Brand Storytelling, Editorial Hero Blocks.

---

### Nike (`design-md/nike/`)
- **What We Learned**:
  - High-energy athletic retail merchandising built on extreme contrast: Towering uppercase display typography burned directly into campaign imagery, paired with a dense, neutral, monochrome retail chrome.
  - Pure black/white/soft-cloud gray palette carrying ~95% of UI surfaces.
  - Pill geometry for all major CTAs (`rounded-full`), filter chips, and search bars.
  - Product cards have zero container borders and zero drop shadows: The photograph *is* the card, sitting on a soft surface backdrop (`#f5f5f5`).
  - Strict 8px grid with section rhythm at 48px; high product-grid scanning density.
  - Color is reserved exclusively for imagery and critical retail signaling (sale red, success green, in-stock ticks).
- **What 1968 Will Use**:
  - Streetwear fashion merchandising: Full-bleed product photos on soft surface backdrops.
  - Photography-first product cards with minimal chrome (no heavy card borders or boxy containers).
  - Tactile pill buttons for primary retail CTAs (Black surface, white text).
  - High-frequency 2-column mobile and 3–4-column desktop product scanning grid.
  - Direct metadata hierarchy beneath image: Product Name -> Subtitle/Variant -> Price.
- **What 1968 Will NOT Copy**:
  - Proprietary Nike Futura ND font.
  - Giant sportswear branding or oversized marketing claims.
  - Excessive sport-specific categorization.
- **Product Areas**:
  - Product Catalog (PLP), Product Grid, Campaign Banners, Storefront Merchandising.

---

### Airbnb (`design-md/airbnb/`)
- **What We Learned**:
  - Consumer-friendly, approachable marketplace navigation.
  - Controlled card spacing and generous, human-friendly whitespace.
  - Prominent, approachable search and filter pills (`rounded-full` 48-64px).
  - Understated typographic weights (weights 500/600 rather than heavy 800/900).
  - Clean category strips with active bottom underlines.
  - Touch-friendly 44px+ interactive targets everywhere.
- **What 1968 Will Use**:
  - Approachable mobile and desktop navigation.
  - Category filter tabs with clean active indicators.
  - User-friendly search inputs with generous touch areas.
  - Clear spacing between interactive targets to prevent mis-taps on mobile.
- **What 1968 Will NOT Copy**:
  - Airbnb Rausch coral/pink color (`#ff385c`).
  - Rental property metadata (guest counts, bedrooms, star ratings).
  - Vacation marketplace visual softness.
- **Product Areas**:
  - Header Navigation, Mobile Navigation Drawer, Category Filters, Account Settings.

---

### Meta (`design-md/meta/`)
- **What We Learned**:
  - E-commerce hardware and apparel product presentation.
  - Product Detail Page (PDP) composition: 60/40 desktop split (60% gallery / 40% purchase rail).
  - Tactile variant/SKU selection pills (size, finish, color) with clear selected, available, and disabled states.
  - Dual CTA rhythm: Black solid primary button + outlined secondary button.
  - Clean order summary cards with subtle 1px borders and soft 1px border elevation.
  - Sticky mobile purchase action bar for uninterrupted conversion flow.
- **What 1968 Will Use**:
  - 60/40 Product Detail Page layout.
  - Dedicated tactile size selector buttons (XS, S, M, L, XL) directly on the PDP purchase rail.
  - Inline Size Guide trigger placed immediately adjacent to size selection controls.
  - Sticky mobile purchase bar with instant "Add to Bag" action.
  - Clean checkout summary card architecture.
- **What 1968 Will NOT Copy**:
  - Meta cobalt blue (`#0064e0`) or Facebook blue accents.
  - Tech hardware configurator complexities.
  - Overly rounded 32-40px container cards.
- **Product Areas**:
  - Product Detail Page (PDP), Variant Selectors, Checkout Summary, Sticky Mobile Actions.

---

### Webflow (`design-md/webflow/`)
- **What We Learned**:
  - High operational density without visual fatigue.
  - Precise typographic hierarchy with crisp uppercase micro-labels (10-12px, tracking +0.05em to +0.1em).
  - Restrained corner radius scale: 2px (xs), 4px (sm), 8px (md).
  - Crisp 1px hairline borders (`#d8d8d8` / `#e5e5e5`) defining structured data areas.
  - Fast, utilitarian forms and data tables designed for operational efficiency.
- **What 1968 Will Use**:
  - Admin operational workspace styling: Compact tables, dense status badges, drawer panels.
  - Uppercase micro-label discipline for order metadata, SKUs, timestamps, and drop tags.
  - Restrained 4px/8px corner radii for administrative inputs, tables, and buttons.
  - 1px hairline dividers for clear data separation without background noise.
- **What 1968 Will NOT Copy**:
  - Webflow 5-stop chromatic category colors (purple/pink/orange/green).
  - Software canvas UI widgets.
- **Product Areas**:
  - Admin Dashboard, Admin Orders Queue, Payment Review Workspace, Inventory Tables.

---

### Shopify & Commerce Systems (`design-md/shopify/`)
- **What We Learned**:
  - Strict separation of concern: Storefront is editorial and emotional; Admin is operational and rapid.
  - Merchant workflows: Fast search, status filtering, batch inspection, and persistent summary rails.
  - Point-of-Sale (POS) layout: Split-screen architecture with catalog on the left, persistent sale ticket/cart on the right, quick quantity adjustments, and fast checkout triggers.
  - Transactional clarity: Order totals, line-item itemization, payment state indicators, and delivery facts.
- **What 1968 Will Use**:
  - Admin POS split-pane workspace (Catalog + Persistent Current Sale register).
  - Fast keyboard shortcuts (`/` for search focus).
  - Comprehensive order timeline and fulfillment transition states.
  - High-contrast payment verification workspace (comparison of expected vs claimed amounts + receipt zoom/rotate).
- **What 1968 Will NOT Copy**:
  - Shopify green/pistachio color palette (`#008060`, `#c1fbd4`).
  - Generic SaaS multi-tenant navigation menus.
- **Product Areas**:
  - Admin POS (`/admin/pos`), Admin Orders, Admin Payments, Checkout Architecture.

---

### Bryl Minimal (`bryl-minimal-design-main/`)
- **What We Learned**:
  - True monochrome discipline: Black (`#0a0a0a`), White (`#ffffff`), and a 9-step neutral gray ramp.
  - Emphasis via inversion: Instead of adding accent colors, invert the element (black pill on white surface, white text on black pill).
  - Typographic roles: Clear separation between local SF Pro Display for editorial hierarchy, the system UI text stack for interface reading, and native Mono for metadata/tags.
  - Restrained motion: 150-200ms micro-interactions, no bouncy spring effects, no motion blocking navigation.
- **What 1968 Will Use**:
  - Pure monochrome streetwear palette (`#0a0a0a` ink, `#ffffff` canvas, `#f5f5f5` surface).
  - Inverted high-emphasis CTAs.
  - Monospace uppercase eyebrow tags for streetwear archive drop codes (`DROP 01`, `EST. 1968`).
  - Snappy 150-200ms transitions.
- **What 1968 Will NOT Copy**:
  - Halftone dot texture overlays across transactional screens (keep commerce crisp and clean).
  - Serif long-form blog typography for commerce products.
- **Product Areas**:
  - Global Design System Tokens, Button Hierarchy, Eyebrow Labels, Footer.

---

## 2. External Baymard Ecommerce UX Research Findings

Authoritative research from the Baymard Institute on apparel ecommerce dictates the following critical UX requirements:

1. **Size Selection & Availability (Apparel Core)**:
   - *Finding*: Hiding clothing sizes (XS-XL) inside a `<select>` dropdown increases interaction cost and conceals out-of-stock states, causing high bounce rates.
   - *1968 Rule*: Expose all available sizes as tactile button chips directly on the PDP. Clearly strike through or dim unavailable variants.
2. **Size Guide Placement**:
   - *Finding*: Placing the Size Guide in an accordion or tabs below the fold forces customers to scroll away from the purchase button, causing abandoned purchases.
   - *1968 Rule*: Anchor the "Size Guide" button directly adjacent to the Size label above the size buttons. Open in an accessible modal/dialog that retains the customer's scroll position.
3. **Product Listing Page (PLP) Visual Scanning**:
   - *Finding*: Complex cards with nested boxes, excessive text, and heavy borders distract users from assessing the garment.
   - *1968 Rule*: Keep card chrome minimal. The image occupies 85% of the card area; product name, variant subtitle, and price sit cleanly below in an 8px vertical rhythm.
4. **Cart Transparency**:
   - *Finding*: Ambiguous line items or hidden shipping charges at the cart stage cause checkout abandonment.
   - *1968 Rule*: Cart items must explicitly display the garment thumbnail, product title, chosen size, unit price, quantity stepper, line total, and instant remove button. Subtotal and the authoritative Store Settings threshold ("Free delivery over `{freeShippingThreshold}`") must be plainly visible.
5. **Mobile Single-Device Payment Friction (GCash)**:
   - *Finding*: When customers browse and pay on the same smartphone, displaying a QR code without a save option creates a dead end.
   - *1968 Rule*: Provide explicit "Save QR to Photos" and "Copy Number" buttons alongside the QR display, guiding the customer to use GCash's native "Upload QR from Gallery" flow.
6. **Authentication Friction**:
   - *Finding*: Auth screens that push input fields below the mobile fold or overlap forms with branding banners cause immediate user drop-off.
   - *1968 Rule*: Login and signup forms must be front-and-center, `100svh` compliant, with zero overlap and clear primary button hierarchy.

---

## 3. Product Area Allocation Matrix

| Product Area | Primary Reference | Key Adopted Patterns | Strictly Prohibited |
| :--- | :--- | :--- | :--- |
| **Global Shell & Tokens** | Bryl Minimal + Apple | Monochrome ramp, local SF Pro Display plus system UI text, 4px/8px rhythm | Runtime font requests, colored accents, gradients, heavy shadows |
| **Customer Header** | Nike + Airbnb | Slim 56-60px header, prominent bag pill with counter | Cluttered mega-menus, oversized banners |
| **Homepage** | Nike + Apple | Full-bleed editorial campaign hero, clean drop rows | SaaS feature cards, generic hero copy |
| **Catalog (PLP)** | Nike + Baymard | 2-col mobile / 4-col desktop, minimal card chrome, 8px info gap | Boxed dashboard cards, hidden prices |
| **Product Detail (PDP)** | Meta + Baymard | 60/40 gallery split, tactile size chips, inline size guide, sticky mobile CTA | Dropdown size selects, buried size guides |
| **Cart & Bag** | Baymard + Shopify | Clear line items, size tags, instant steppers, free delivery bar | Cluttered nested boxes, hidden fees |
| **Checkout** | Shopify + Baymard | Quiet distraction-free layout, 60/40 summary split | Promotional clutter, ambiguous totals |
| **GCash Payment** | Domain + Mobile UX | Live countdown, QR download, number copy, receipt preview, clear timeline | Auto-marking paid on upload, dead-end QR |
| **Customer Account** | Airbnb + Bryl Minimal | Unified account shell, 44px tabs, clean addresses/orders | Inconsistent layouts, oversized headings |
| **Admin Operations** | Webflow + Shopify | High density, compact tables, operational drawer | Airy marketing whitespace, giant cards |
| **Admin POS** | Shopify POS | Split catalog + persistent register, rapid variant pills, `/` search shortcut | Slow confirmation dialogs for routine actions |
| **Payment Review** | Custom E-Commerce Workspace | Split-pane queue + large receipt preview with zoom/rotate, comparison header | Five scattered cards, multiple page clicks |

---

## 4. External Research Sources

Reviewed September 20, 2026. These sources informed the rules above; they are evidence, not visual templates to copy.

- [Baymard: Apparel & Accessories UX benchmark](https://baymard.com/audits/apparel-and-accessories)
- [Baymard: Put the size filter near the top](https://baymard.com/research-articles/apparel-put-size-filter-near-top-and-expand-for-sidebar-filtering)
- [Baymard: Format apparel size options](https://baymard.com/research-articles/apparel-how-to-format-size-options-in-the-size-filter)
- [Baymard: Apparel size information](https://baymard.com/research-articles/apparel-size-information)
- [Baymard: In-scale product images](https://baymard.com/research-articles/in-scale-product-images)
- [Baymard: Product Page UX research](https://baymard.com/research/product-page)
- [Baymard: Product List UX research](https://baymard.com/research/ecommerce-product-lists)
- [Baymard: Checkout UX audit methodology](https://baymard.com/checkout-usability/expert-audit)
