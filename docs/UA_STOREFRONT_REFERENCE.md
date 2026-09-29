# 1968 V2 — UA Worldwide Storefront Reference & Design Audit

**Date:** 2026-09-29  
**Branch:** `rebuild/1968-v2`  
**Primary Reference:** `https://www.uaworldwide.com/` (live inspection verified via Chromium automation)  
**Secondary References:** `https://www.uaworldwide.com/collections`, `https://www.uaworldwide.com/collections/all`  
**Scope:** Storefront Retail Architecture & Visual Translation for 1968 Clothing  

---

## 1. Executive Summary & Design Philosophy

The 1968 V2 storefront reconstruction combines three pillars:
1. **UA Worldwide Shopping Hierarchy**: Minimalist, product-first, black/white, high-contrast, image-dominant, zero marketing fluff or dashboard cards.
2. **1968 Brand Identity**: Archival Filipino streetwear ("Defend the Culture", "Est. 1968"), authentic photography, verified category taxonomy, and honest local craftsmanship.
3. **Verified 1968 Commerce Backend**: Authoritative integer centavos money, server-calculated carts, real PostgreSQL inventory and safety stock invariants, AAL2 admin boundaries, and manual GCash / Cash on Delivery payments.

**Core Visual Distinction:**
- **Admin Side**: TailAdmin operational dashboard (slate/blue, status pills, dense tables, data toolbars, system metrics).
- **Storefront Side**: UA-inspired luxury streetwear retail (stark white background `#ffffff`, near-black typography `#121212`, zero-radius sharp rectangular product imagery, high-density product discovery immediately visible above the fold, no rounded cards, no glassmorphism, no marketing obstruction).

---

## 2. Live UA Worldwide Reference Audit Matrix

Based on live browser extraction of `https://www.uaworldwide.com/` and `https://www.uaworldwide.com/collections/all`:

| Surface / Pattern | Live UA Implementation Details | Classification | 1968 V2 Operational & Visual Translation |
| :--- | :--- | :---: | :--- |
| **1. Announcement Bar** | Stark black bar (`rgb(11, 11, 11)`), white monospace/condensed text (`rgb(255, 255, 255)`), 16px, uppercase, 9px vertical padding. | **ADAPT** | Render stark black announcement bar using real persisted 1968 setting from `public.store_settings`. If disabled in admin, render nothing. Reject hardcoded cycling promotional popups. |
| **2. Header & Desktop Nav** | Compact white bar (`rgb(255, 255, 255)`), 114px height with centered logo, clean text navigation (`Home`, `Size Chart`, `Collections`), search icon, account link, shopping bag with item count badge. | **ADAPT** | Clean white sticky/compact header. Left/Center 1968 branding, semantic navigation (`Shop`, `Size Guide`, `Story`, `Track Order`), accessible icon buttons for Search, Account, and Bag. Touch targets strictly $\ge 44\text{px}$. |
| **3. Mobile Header & Menu** | Hamburger toggle, centered logo, search, bag. Drawer slides out with stark dark overlay, uppercase navigation links with subtle arrows, no bloated marketing blocks. | **ADAPT** | Mobile drawer using accessible Radix dialog with focus trap, Escape key closure, focus return, background inertness. Clean links only (Shop, Size Guide, Story, Track Order, Account, Bag). No search form inside menu (search has its own drawer). |
| **4. Hero / Banner Obstruction** | Minimal to non-existent hero section on homepage. Page transitions immediately into product grid (`ua_grid`). | **ADOPT** | Excised all giant marketing heroes. Homepage starts immediately with Category/Collection rail followed by product grid. An optional restrained brand kicker is permitted below products, not blocking them. |
| **5. Collection / Category Rail** | Fast horizontal navigation across collections (`All Products`, `UA Box Tees`, `UA Caps`, etc.). Desktop: clean horizontal bar. Mobile: smooth horizontal scroll. | **ADAPT** | Horizontal category rail populated dynamically from canonical `public.categories`. First item is "All", followed by active categories. Zero hardcoded fake taxonomy. |
| **6. Product Card Image Hierarchy** | 1:1 square sharp media (`--product-card-corner-radius: 0.0rem`), zero border radius, image fills entire frame, subtle zoom on hover. | **ADOPT** | Adopt 1:1 square aspect ratio with sharp zero-radius corners. Primary catalog image loaded with priority for above-the-fold tiles. Secondary hover image on pointer devices if multiple images exist. |
| **7. Product Card Details** | Product title (clean bold/medium), price in PHP (e.g. `₱999.00 PHP`), action label (`Choose options` or `Add to cart`). No SKU, no stock counts, no admin metadata. | **ADAPT** | Restrained typography: Product Name, formatted price (`₱X,XXX.00`), and clean action indicator (`Choose Options` or `Out of Stock`). Factual badge only for out of stock. |
| **8. Collection Page Layout** | Minimal collection header: Title (`All products`), exact product count (`91 products`), Filter and Sort controls, followed directly by multi-column product grid. | **ADOPT** | Rebuild `/products` with minimal retail header: Collection title, retail count (e.g. `11 products`, not database query counts), Category, Availability, and Sort dropdowns. |
| **9. Filter & Sort Controls** | Retail-native filter dropdowns/sheets (Availability, Price) and sort selector (`Newest`, `Price: Low to High`, `Price: High to Low`, `Alphabetical`). | **ADAPT** | Compact desktop controls and mobile bottom drawer. Filter by canonical Category and Availability (`In Stock`). Sort by `newest`, `price_asc`, `price_desc`, `name_asc`. Full query parameter preservation. |
| **10. Predictive Search Drawer** | Header search icon opens overlay with instant input, live autocomplete results displaying thumbnail, title, price, and stock status. | **ADAPT** | Accessible drawer opening from header. Integrates with verified `/api/search` route. Supports full keyboard navigation (`ArrowDown`, `ArrowUp`, `Enter`, `Escape`), aria-live status, and thumbnail previews. |
| **11. Retail Footer** | Clean columns: Social links (Facebook, Instagram, YouTube, TikTok), Customer Care (Size Guide, Track Order, Account), Legal/Policies (Contact, Refund, Terms, Privacy, Shipping). | **ADAPT** | Multi-column dark/clean footer with 1968 brand copy from `store_settings`, verified customer care links, and contact email. Reject fake app store links or unverified social accounts. |
| **12. Promotional Exit Popups / 20% Off** | Third-party popups (`ua-promo-popup`, "20% Off Sitewide", "Don't Go Without Saving"). | **REJECT** | Strictly rejected. No annoying exit-intent modals, fake coupon wheels, or intrusive marketing traps. |
| **13. Fake Customer Reviews / Judge.me** | Third-party review widgets with automated review generation, star badges, and photo carousels. | **REJECT** | Strictly rejected. 1968 has no public review submission pipeline. Displaying fake or unverified customer reviews violates Rule 4 (No Fake Claims). |
| **14. Unbacked Fabric Claims** | Marketing claims such as "300GSM", "500GSM", "Shrink-free", "Heavyweight Fleece". | **REJECT** | Strictly rejected unless explicitly documented in product description from staff. No dedicated GSM badge widgets. |

---

## 3. Existing 1968 Storefront Audit & Migration Plan

| Route / Component | Current Implementation | Audit Finding | Target Action |
| :--- | :--- | :--- | :---: |
| `/` (Homepage) | Hero section with story text, followed by catalog rail, 8-product grid, and story footer. | Functional, but hero creates unnecessary obstruction before products. | **REBUILD STRUCTURE & VISUAL**<br>(Products immediately below collection rail; sharp UA card styling) |
| `/products` (Catalog) | Header, search bar, category rail, checkbox filters, sort select, active filter pills, product grid. | Strong functionality, but styling uses bulky card-like containers and dashboard-esque borders. | **REBUILD VISUAL**<br>(Keep all filter/sort query logic; adopt sleek UA retail toolbar and grid) |
| `/categories/[slug]` | Dedicated category page mirroring `/products`. | Redundant code path that duplicates `/products?category=slug`. | **KEEP BEHAVIOR & REBUILD VISUAL**<br>(Preserve route for SEO; align with `/products` layout) |
| `StorefrontChrome` | Header with logo, nav links, search trigger, cart badge, mobile drawer, footer. | Working well, but header height, fonts, and borders need UA refinement. | **REBUILD VISUAL**<br>(Sharp, minimalist black/white aesthetic; $\ge 44\text{px}$ touch targets) |
| `AnnouncementBar` | Server component reading `store_settings.announcement`. | Working correctly; needs UA stark black styling and clean typography. | **REBUILD VISUAL**<br>(Keep server-side query; update layout to match UA marquee) |
| `PredictiveSearch` | Expandable search drawer with debounced `/api/search` queries. | Excellent keyboard support and live autocomplete; needs visual alignment with UA. | **REBUILD VISUAL**<br>(Sharp rectangular thumbnails, clean typography, visible focus) |
| `ProductCard` | Article container with 4:5 aspect ratio image, category name, title, price, choose options button. | Good foundation, but uses 4:5 ratio with rounded borders and pill badges. | **REBUILD VISUAL**<br>(1:1 square ratio, zero border radius, stark typography, sharp state indicator) |
| `MobileNav` | Radix Dialog drawer with dark overlay and navigation links. | Accessible and operable; needs visual polish to match UA typography. | **REBUILD VISUAL**<br>(Keep Radix dialog semantics; refine spacing and font hierarchy) |
| `CartBadge` | Server component calculating live cart count. | Perfect server-side calculation for guest cookie and authenticated DB cart. | **KEEP BEHAVIOR & REBUILD VISUAL**<br>(Retain count logic; refine bag icon and badge styling) |
| Footer | 4-column footer with settings fallback. | Functional; needs visual tuning to match UA high-density column rhythm. | **REBUILD VISUAL**<br>(Clean typography, proper semantic groups, zero fake links) |
| `/products/[slug]` (PDP) | Dedicated product page with gallery and size selector. | Scope for next phase. | **DEFERRED TO PHASE 2** |
| `/cart` | Shopping cart drawer/page. | Scope for next phase. | **DEFERRED TO PHASE 2** |
| `/checkout` | Order checkout and payment selection. | Frozen business logic. | **DEFERRED TO PHASE 2** |
| `/account` | Customer account dashboard. | Scope for next phase. | **DEFERRED TO PHASE 2** |

---

## 4. Storefront Design Tokens & Foundation

To prevent Admin V2 styles (`slate-800`, `blue-600`, dashboard rounded cards) from leaking into the storefront, the retail layer enforces strict minimalist tokens:

- **Background**: `#ffffff` (Pure White)
- **Foreground / Text**: `#121212` (Deep Charcoal / Near-Black)
- **Secondary / Muted Text**: `#767676` (Neutral Gray)
- **Border**: `#e5e5e5` (Subtle 1px divider)
- **Primary Action**: `#000000` (Solid Black)
- **Primary Action Text**: `#ffffff` (Solid White)
- **Corner Radius**: `0px` (`rounded-none` for all product media and primary action buttons)
- **Pill Radius**: `9999px` (Reserved only for category rail and status indicator badges)
- **Typography**: Apple SF Pro Display / Assistant editorial clean sans-serif.
- **Grid Layout**: 2 columns on mobile ($<640\text{px}$), 3 columns on tablet ($640\text{px}-1024\text{px}$), 4 columns on desktop ($>1024\text{px}$).

---

## 5. Implementation Roadmap (First Storefront Scope)

1. **Phase 1A**: Storefront Shell Components (`StorefrontChrome`, `AnnouncementBar`, `BrandLogo`, `CartBadge`).
2. **Phase 1B**: Navigation & Search (`PrimaryNav`, `MobileNav`, `PredictiveSearch`).
3. **Phase 1C**: Product Grid & Cards (`ProductCard`, 1:1 image ratio, stock state).
4. **Phase 1D**: Homepage Reconstruction (`src/app/page.tsx` — products first, zero hero obstruction).
5. **Phase 1E**: Collection & Catalog Reconstruction (`src/app/products/page.tsx` & `src/app/categories/[slug]/page.tsx`).
6. **Phase 1F**: Retail Footer.
7. **Phase 1G**: Quality Gates & Validation (Typecheck, Lint, Tests, Axe accessibility, Responsive matrix, Keyboard QA).
