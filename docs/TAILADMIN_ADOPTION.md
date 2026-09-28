# TailAdmin Design Inventory & Adoption Plan

**Project:** 1968 Admin V2  
**Target:** TailAdmin Structural Foundation + 1968 Streetwear Minimalism  
**Document:** `docs/TAILADMIN_ADOPTION.md`  

---

## 1. Executive Strategy

We are adopting TailAdmin's structural hierarchy, spacing discipline, tabular layouts, responsive drawer behaviors, and form systems to establish a production-grade administrative foundation. 

Rather than importing TailAdmin wholesale (which would bring dependency conflicts, framework mismatches, and mock business logic), we port TailAdmin's visual patterns into native, accessible, type-safe Next.js components that bind directly to our verified Supabase backend.

---

## 2. Component Classification Matrix

### A. ADOPT (Direct Structural & Visual Adoption)
These TailAdmin patterns provide clean data-dense administrative UX and will be directly adapted with 1968 styling tokens:

| Pattern / Component | TailAdmin Reference | 1968 Implementation | Notes |
| :--- | :--- | :--- | :--- |
| **Admin Shell Layout** | Dual-pane desktop (fixed/sticky sidebar + topbar + main content container) | `src/components/admin/admin-shell.tsx` | Clean desktop/tablet/mobile viewport containment with zero horizontal scroll. |
| **Data Table Layout** | High-density data grid with subtle header borders and striped/hover rows | `src/components/admin/admin-table.tsx` | Strict column alignment: Text/Status/Date (Left), Qty/Money/Actions (Right). |
| **Page Header Composition** | Standardized eyebrow, H1, description, and primary CTA row | `src/components/admin/admin-page-header.tsx` | Consistent rhythm across every administrative view. |
| **Filter & Search Bar** | Inline search field + select dropdowns + reset trigger | `src/components/admin/admin-filter-bar.tsx` | Clean horizontal bar above data tables. |
| **Status Badges** | Rounded pill badges with dot indicator or subtle tinted background | `src/components/admin/status-badge.tsx` | Semantic states: `neutral`, `info`, `success`, `warning`, `danger`. Always paired with text. |
| **Stat KPI Cards** | Compact stat card with title, large numerical metric, and context subtitle | `src/components/admin/stat-card.tsx` | Used on Overview to answer "What needs attention?" with real database queries. |
| **Form Controls** | Clean label hierarchy, crisp border-input fields, focus ring, error text | Reusable form elements in `@/components/ui/input`, `select`, `textarea` | Consistent 44px min touch target and accessible labeling. |
| **Loading Skeletons** | Pulse animation on table rows and metric cards | `src/components/admin/table-skeleton.tsx` | Provides instant feedback without layout shift. |
| **Empty States** | Centered icon, title, description, and optional action button | `src/components/admin/empty-state.tsx` | Clear guidance when queries return zero records. |

---

### B. ADAPT (Ported & Reskinned to 1968 Invariants)
These components take TailAdmin's presentation but strictly preserve V1's interaction and security invariants:

| Component | TailAdmin Pattern | V1 Invariant to Preserve | Adaptation Details |
| :--- | :--- | :--- | :--- |
| **Sidebar Navigation** | Multi-level collapsible tree with generic links | Role-based navigation (`cashier`, `admin`, `super_admin`) & real routes | Grouped by operational domains: `OVERVIEW`, `COMMERCE`, `MERCHANDISE`, `RETAIL`, `CUSTOMERS`, `ADMINISTRATION`. Preserves verified accessibility (focus trap, Escape key, backdrop dismiss). |
| **Admin Header / Topbar** | Generic notification bell, search bar, language switcher, profile dropdown | Simple context-aware topbar; no fake AI/notifications | Shows breadcrumb context, staff email, role badge (`admin` / `super_admin`), and sign-out button. Mobile drawer toggle button. |
| **Modal / Dialog Primitives** | Generic modal popup | Radix UI dialog with focus lock and Escape handling | Keep Radix UI accessibility primitives; style dialog surface, header, and buttons using TailAdmin visual spacing. |
| **Product Row in Catalog** | Nested card layouts | High-density tabular row | Product image thumbnail, Title + Slug, Category badge, Variant count, Total available stock, Price, Status badge, and Action menu. Avoid card bloat. |
| **Stock Adjustments** | Uncontrolled input counter | Transactional PostgreSQL RPC `admin_adjust_inventory` | Dedicated modal/drawer requiring variant ID, delta quantity ($\pm$), movement type (`adjustment` or `restock`), and a mandatory traceable reason. |

---

### C. REJECT (Irrelevant / Fake Demo Features)
The following generic demo features from TailAdmin are explicitly rejected to prevent dead code and dependency bloat:

* ❌ **Calendar / Scheduler**: No business requirement for event scheduling.
* ❌ **Generic Chat Demo**: Our support desk uses real PostgreSQL `support_messages` and Supabase Realtime; do not import demo chat mocks.
* ❌ **AI Dashboard / Assistant ("Ask 1968", Gemini, n8n)**: Explicitly removed in Phase 13 per system contracts; do not reintroduce.
* ❌ **Marketing / Campaign Analytics**: No authoritative tracking pixels or ROAS data; no speculative graphs.
* ❌ **Stock Market / Crypto Dashboards**: Completely out of domain scope.
* ❌ **Interactive Maps**: Courier operations are provider-agnostic without GPS/map dependencies.
* ❌ **Generic CRM / Lead Pipelines**: Customer accounts are order-centric.
* ❌ **Kanban Boards**: Orders use database status filters and fulfillment queues.
* ❌ **SaaS Invoicing & Subscriptions**: Streetwear retail uses standard order receipts and POS slips.
* ❌ **ApexCharts / Chart.js Bloat**: Use minimal inline SVGs for real 30-day paid revenue trends.

---

## 3. Visual Design System: TailAdmin Structure + 1968 Minimalism

### Color Palette Tokens
| Token | Light Mode Value | Usage |
| :--- | :--- | :--- |
| **Background (Canvas)** | `#f8fafc` (Slate 50) / `#f4f5f7` | Page workspace background |
| **Surface (Card / Table)** | `#ffffff` (Pure White) | Card containers, table rows, header |
| **Border** | `#e2e8f0` (Slate 200) / `#eaecf0` | Dividers, table borders, card outlines |
| **Text Primary** | `#0f172a` (Slate 900) / `#111827` | Headings, primary metrics, titles |
| **Text Secondary** | `#475569` (Slate 600) / `#6b7280` | Subtitles, labels, descriptions |
| **Text Muted** | `#94a3b8` (Slate 400) | Timestamps, metadata, SKU identifiers |

### Semantic Accent Tokens (Restricted to Operational Meaning)
* **Success**: `#059669` (Emerald 600) / `#ecfdf5` (Emerald 50) — Delivered, Paid, In Stock
* **Warning**: `#d97706` (Amber 600) / `#fffbeb` (Amber 50) — Low Stock, Awaiting Review, Pending
* **Danger**: `#dc2626` (Red 600) / `#fef2f2` (Red 50) — Out of Stock, Failed, Cancelled, Rejected
* **Info**: `#0284c7` (Sky 600) / `#f0f9ff` (Sky 50) — Processing, Shipped, AAL2 Verified

### Typography Hierarchy
* **Page Eyebrow**: `text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500`
* **Page H1 Title**: `text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl`
* **Card Title**: `text-base font-semibold text-slate-900`
* **Metric Value**: `text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 tabular-nums`
* **Table Header**: `text-xs font-semibold uppercase tracking-wider text-slate-500`
* **Body / Cell**: `text-sm font-medium text-slate-700`
* **Monospace Identifier**: `font-mono text-xs text-slate-600` (SKUs, UUIDs, Money)

---

## 4. Foundation Implementation Scope

The structural core encompasses:
1. `/admin` (Overview Operations Center)
2. `/admin/catalog` (Merchandise Catalog)
3. Reusable TailAdmin operational primitives (`AdminShell`, `AdminSidebar`, `AdminHeader`, `AdminTable`, `AdminFilterBar`, `AdminToolbar`, `AdminPageHeader`, `StatusBadge`, `StockAdjustDialog`, `StatCard`, loading/empty/error states).

---

## 5. Domain Boundary: Catalog vs. Inventory

| Dimension | Catalog (`/admin/catalog`) | Inventory (`/admin/inventory`) |
| :--- | :--- | :--- |
| **Operational Question** | *What merchandise do we sell?* | *What physical quantities exist right now?* |
| **Primary Domain Scope** | Products, categories, slugs, descriptions, published status, option dimensions (Color/Size), media galleries, base variant options. | Physical stock ledger, SKUs, on-hand counts, active reservations, net available stock, safety thresholds, movements. |
| **Key Actions** | Create Product, Edit Metadata, Upload Media, Add Variant, Archive Product. | Quick Restock (+ batch), Audit Discrepancy (± count write-off), Trace Movement History. |
| **Status Vocabulary** | `ACTIVE`, `DRAFT`, `ARCHIVED` | `AVAILABLE`, `OUT_OF_STOCK` (Note: `LOW_STOCK` is an operational query heuristic based on `safety_stock`, not a database enum). |

### Canonical Inventory Workspace Contract (`/admin/inventory`)
- **Query Foundation**:
  ```sql
  SELECT i.variant_id, i.on_hand, i.reserved, i.safety_stock,
         v.sku, v.name as variant_name, v.price_minor, v.status as variant_status,
         p.name as product_name, p.slug
  FROM inventory i
  JOIN product_variants v ON v.id = i.variant_id
  JOIN products p ON p.id = v.product_id;
  ```
- **Standard Columns**:
  - `Product`: Brand item name and link
  - `Variant / Size`: Specific sizing or option
  - `SKU`: Monospace unique stock identifier
  - `On Hand` (Numeric right): Physical count in warehouse
  - `Reserved` (Numeric right): In-checkout or pending order reservations
  - `Available` (Numeric right, bold): Authoritative `(on_hand - reserved)`
  - `Stock Status`: `Available` (green) vs `Out of Stock` (red) vs `Safety Risk` (amber if `available <= safety_stock`)
  - `Actions`: `StockAdjustDialog` trigger (`admin_adjust_inventory`)

---

## 6. Product Editor Architecture (`/admin/catalog/[productId]`)

Instead of overloading a single dialog or table row with nested multi-domain mutations, the dedicated product route `/admin/catalog/[productId]` organizes workflows into contextual sections:
1. **Overview**: Product name, slug, description, category selector, active/draft status.
2. **Media**: WebP/PNG/JPEG gallery (max 5 MiB), ordering, primary cover selection, file preview.
3. **Options**: Option definitions (e.g. Size, Color) and attribute values.
4. **Variants**: Tabular variant generator (Size $\times$ Color), SKU assignment, variant-level pricing.
5. **Inventory**: Variant-level on-hand stock and safety thresholds. All variant additions inherit product context automatically without redundant product selection prompts.

