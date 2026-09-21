# 1968 Clothing — Admin Capability Audit

**Audit Date:** 2026-09-19  
**Status:** Comprehensive Operational & Security Capability Review  
**Authority:** `docs/architecture/MASTER_ARCHITECTURE.md`, `AGENTS.md`  

This document evaluates the operational capabilities of the administrative system, comparing database schema rules, security boundaries, and currently implemented user interfaces. Per the project architecture, operational safety strictly takes precedence over arbitrary CRUD: destructive deletions of historical facts (orders, payments, audit logs, inventory history) are strictly forbidden, and lifecycle states (archive, deactivate, transition) are enforced.

---

## Resource Capability Matrix

### 1. Dashboard (`/admin`)
- **READ:** Full aggregation of 30-day paid sales, paid order volume, items sold, AOV, inventory risks, waiting GCash submissions, dispatch queues, delivery exceptions, top products, slow movers, and recent audit events.
- **CREATE:** N/A (Dashboard is an analytical read model).
- **UPDATE:** Period selection (Last 30 days vs prior 30 days comparison).
- **DELETE / ARCHIVE:** N/A.
- **SPECIAL OPERATIONS:** Exception alerts drill-down linking directly to filtered queues (`/admin/payments`, `/admin/orders?status=READY_FOR_SHIPMENT`, `/admin/catalog`, `/admin/orders?status=DELIVERY_FAILED`).
- **AUTHORIZATION:** `admin` or `super_admin` role with active `aal2` session.
- **CURRENT UI:** Operational Control Center (`src/app/admin/page.tsx`) with 4 KPI cards, Needs Attention alert block, 30-day SVG revenue trend, top 5 products ranking, inventory safety stock health panel, merchandising opportunities, and live audit feed.
- **MISSING UI:** Custom date range picker (currently fixed to 30-day rolling comparison).
- **RECOMMENDED UI:** Add explicit date range filter dropdown (7D / 30D / 90D) while retaining UTC boundary evaluation.

---

### 2. Products (`/admin/catalog`)
- **READ:** Lists all products with status, category association, created date, variant count, and media links.
- **CREATE:** Supported via `ProductDialog` modal (`createProduct` server action calling `admin_create_product` RPC). Generates unique slug, validates category.
- **UPDATE:** Supported via `ProductDialog` modal (`updateProduct` server action). Can edit title, description, category, and lifecycle status (`draft`, `published`, `archived`).
- **DELETE / ARCHIVE:** Soft archival supported via status update (`archived`). Hard deletion disabled in schema when associated with order history or inventory records.
- **SPECIAL OPERATIONS:** Image association and variant binding.
- **AUTHORIZATION:** `admin` or `super_admin` with `aal2`.
- **CURRENT UI:** Products listed in dense data table with status badges (`published`, `draft`, `archived`), variant counts, and direct action triggers.
- **MISSING UI:** Bulk status archiving.
- **RECOMMENDED UI:** Retain single-item modal for safety; add batch selection for multi-product status changes if catalog exceeds 100 SKUs.

---

### 3. Categories (`/admin/catalog`)
- **READ:** Categories loaded with slug, display name, display position, and archival status.
- **CREATE:** Supported via `CategoryDialog` (`createCategory` action). Generates slug, position indexing.
- **UPDATE:** Supported via `CategoryDialog` (`updateCategory` action). Edits name and display position.
- **DELETE / ARCHIVE:** Soft archival supported (`archived_at` timestamp). Direct deletion blocked if foreign key references exist in `products`.
- **SPECIAL OPERATIONS:** Display ordering hierarchy.
- **AUTHORIZATION:** `admin` or `super_admin` with `aal2`.
- **CURRENT UI:** Managed in Category dialog modal accessible from catalog header.
- **MISSING UI:** Drag-and-drop visual reordering.
- **RECOMMENDED UI:** Numerical position input is currently used; satisfies Ponytail simplicity.

---

### 4. Product Variants (`/admin/catalog`)
- **READ:** Reads SKU, variant title, price (minor units centavos), compare-at price, status, and inventory stock relation.
- **CREATE:** Supported via `VariantDialog` (`createVariant` action). Enforces unique SKU constraint and non-negative integer price.
- **UPDATE:** Supported via `VariantDialog` (`updateVariant` action).
- **DELETE / ARCHIVE:** Status transition to `archived` or `inactive`. Deletion blocked by database constraints if order items reference variant.
- **SPECIAL OPERATIONS:** Atomic price updates in integer minor units.
- **AUTHORIZATION:** `admin` or `super_admin` with `aal2`.
- **CURRENT UI:** Variants listed under their parent products with SKU pill, price in ₱, and stock status.
- **MISSING UI:** Variant option matrix builder (e.g. Size x Color grid generator).
- **RECOMMENDED UI:** Standalone SKU creation modal is safe, direct, and avoids speculative multi-dimensional matrix bugs.

---

### 5. Product Images (`/admin/catalog`)
- **READ:** Reads storage paths from `product-images` bucket, display order, alt text, and variant binding.
- **CREATE / UPLOAD:** Supported via `ProductImageDialog` (`uploadProductImage` action). Streams to public `product-images` bucket and writes metadata record.
- **UPDATE:** Display position reordering and alt text updates.
- **DELETE:** Supported via `deleteProductImage` server action. Removes storage object and deletes database row.
- **SPECIAL OPERATIONS:** Primary packshot selection.
- **AUTHORIZATION:** `admin` or `super_admin` with `aal2`.
- **CURRENT UI:** Image gallery preview modal with delete confirmation.
- **MISSING UI:** In-browser image crop/aspect ratio editor.
- **RECOMMENDED UI:** Rely on pre-cropped 4:5 assets as recommended by commerce standards.

---

### 6. Inventory & Restock (`/admin/catalog`)
- **READ:** Reads `on_hand`, `reserved`, and `safety_stock`. Derives `available = on_hand - reserved`.
- **CREATE / RESTOCK:** Supported via `adjustInventory` server action calling transactional RPC `admin_adjust_inventory`.
- **UPDATE:** Adjust on-hand quantity or change safety stock threshold. Requires reason text for audit trail.
- **DELETE:** N/A (Inventory rows are immutable fixtures bound to variants; zero stock represented as `on_hand = 0`).
- **SPECIAL OPERATIONS:** Creates immutable entry in `inventory_transactions` recording `quantity_delta`, `previous_on_hand`, `new_on_hand`, `reason`, and `actor_id`.
- **AUTHORIZATION:** `admin` or `super_admin` with `aal2`.
- **CURRENT UI:** Inline restock control next to each variant in `/admin/catalog` with delta input, reason field, and safety stock badge.
- **MISSING UI:** Bulk CSV inventory import.
- **RECOMMENDED UI:** Keep transactional single-SKU adjustments for accountability.

---

### 7. Orders (`/admin/orders`, `/admin/orders/[id]`)
- **READ:** Full list of customer orders with filters (`ALL`, `PENDING_PAYMENT`, `PROCESSING`, `READY_FOR_SHIPMENT`, `IN_TRANSIT`, `COMPLETED`, `CANCELLED`, `DELIVERY_FAILED`). Detail view displays items snapshot, recipient address, customer phone, money totals, and timeline.
- **CREATE:** Created by customers via checkout, or by cashiers via `/admin/pos`. Admin manual order entry is handled via POS.
- **UPDATE / ADVANCE:** Controlled status transitions (`advanceOrderStatus` action):
  - `CONFIRMED` → `PREPARING`
  - `PREPARING` → `READY_FOR_SHIPMENT`
  - `READY_FOR_SHIPMENT` → `SHIPPED`
  - `SHIPPED` → `OUT_FOR_DELIVERY`
  - `OUT_FOR_DELIVERY` → `DELIVERED`
  - Cancellation / Failure states with mandatory notes.
- **DELETE:** STRICTLY FORBIDDEN. Financial and legal records cannot be deleted.
- **SPECIAL OPERATIONS:** State transition logging in `order_status_history` and `audit_logs`.
- **AUTHORIZATION:** `admin` or `super_admin` with `aal2`.
- **CURRENT UI:** High-density orders table with tab filters, search by order number / customer, and comprehensive detail workspace (`/admin/orders/[id]`).
- **MISSING UI:** Printable packing slip / thermal dispatch label generation.
- **RECOMMENDED UI:** Future phase courier integration can generate printable PDFs; currently plain text dispatch summary is available.

---

### 8. Payments & Manual GCash (`/admin/payments`)
- **READ:** Queue of pending GCash payment submissions (`SUBMITTED`) and expired payment candidates.
- **CREATE:** Payment record created upon order placement. Submissions created by customers uploading GCash receipt proof.
- **UPDATE / DECISION:**
  - **Approve Payment:** Invokes `approveGcashPayment`. Validates submission, updates payment to `PAID`, converts order status to `CONFIRMED`, locks inventory deduction, logs audit event.
  - **Reject Payment:** Invokes `rejectGcashPayment`. Requires rejection reason ("Illegible receipt", "Amount mismatch", etc.), sets review status to `REJECTED`, notifies customer via order timeline.
  - **Expire Payment:** Invokes transactional RPC `close_expired_gcash_payment`. Releases reserved inventory, sets payment to `EXPIRED` and order to `CANCELLED`.
- **DELETE:** STRICTLY FORBIDDEN. Payment attempts and audit history are permanent.
- **SPECIAL OPERATIONS:** Private receipt viewing via short-lived signed URL or authorized proxy (`/admin/payments/receipts/[submissionId]`). Receipts are NEVER public.
- **AUTHORIZATION:** `admin` or `super_admin` with `aal2`.
- **CURRENT UI:** Split workspace with pending submission cards, zoomable private receipt viewer, expected vs claimed amount verification, reference number matching, and guarded Approve / Reject / Expire action buttons.
- **MISSING UI:** Direct GCash Merchant API webhook reconciliation (intentionally Manual GCash per project scope).
- **RECOMMENDED UI:** Current manual review workspace is complete and meets all security and audit invariants.

---

### 9. Customers & Profiles
- **READ:** User display names, contact emails, phone numbers, and order history associations.
- **CREATE:** Handled via Supabase Auth signup.
- **UPDATE:** Handled via Customer Account (`/account`) or address management (`/account/addresses`).
- **DELETE / ANONYMIZE:** Migration `20260825145507_historical_actor_delete_lifecycle.sql` provides cascade and historical snapshot protection for deleted auth users.
- **AUTHORIZATION:** Customer owns their own profile; Admin has read access via order history.
- **CURRENT UI:** Customer information presented in context across orders and POS.
- **MISSING UI:** Dedicated stand-alone CRM table for cold customer editing.
- **RECOMMENDED UI:** Order-centric and POS customer handling is optimal for retail operations without bloated CRM layers.

---

### 10. Staff & Role Management (`/admin/users`)
- **READ:** Queries `list_staff_roles` RPC to list all authorized administrative users and their assigned roles (`admin`, `super_admin`).
- **CREATE / ASSIGN:** Supported via `manageUserRole` server action (`assign_user_role` RPC).
- **UPDATE:** Role elevation (`admin` ↔ `super_admin`).
- **DELETE / REVOKE:** Role revocation via `revoke_user_role` RPC. Migration `20260825153532_protect_last_super_admin_auth_delete.sql` prevents revoking the last surviving super admin.
- **SPECIAL OPERATIONS:** Enforces AAL2 TOTP verification on all staff actions.
- **AUTHORIZATION:** Strictly restricted to `super_admin` role with `aal2`.
- **CURRENT UI:** Dedicated staff table at `/admin/users` displaying email, active role badge, assignment timestamp, and role modify/revoke buttons.
- **MISSING UI:** Invite new staff via email invitation token.
- **RECOMMENDED UI:** Direct role assignment for existing authenticated accounts satisfies current phase requirements securely.

---

### 11. Audit Logs (`/admin/audit`)
- **READ:** Queries append-only `audit_logs` table. Displays actor role, action type, entity, entity ID, previous state snapshot, new state snapshot, and UTC timestamp.
- **CREATE:** Automatically written by trusted server actions and PostgreSQL triggers upon consequential state changes.
- **UPDATE:** STRICTLY FORBIDDEN. Table is append-only by database design.
- **DELETE:** STRICTLY FORBIDDEN. Audit logs cannot be truncated or deleted.
- **SPECIAL OPERATIONS:** JSON payload inspection for compliance and incident response.
- **AUTHORIZATION:** `admin` or `super_admin` with `aal2`.
- **CURRENT UI:** Filterable, scrollable table at `/admin/audit` with search by action/entity and formatted JSON state diff viewing.
- **MISSING UI:** CSV / JSON audit export button.
- **RECOMMENDED UI:** Add export capability in future compliance audit phase if requested.

---

### 12. Point of Sale (`/admin/pos`)
- **READ:** High-speed published catalog search, category filters, and live available inventory stock counters.
- **CREATE / PROCESS:** `processAdminPosSale` server action executes counter transaction:
  - Generates official POS order with `POS-` prefix.
  - Automatically records Cash on Delivery or Manual GCash settlement.
  - Performs concurrency-safe inventory reservation and deduction.
  - Marks payment as `PAID` and order status as `DELIVERED` immediately.
  - Writes audit log with staff actor ID.
- **UPDATE:** In-terminal sale adjustment (quantity increment/decrement, variant switching, customer name/phone).
- **DELETE:** Item removal from active sale basket.
- **SPECIAL OPERATIONS:** Instant digital sale receipt presentation.
- **AUTHORIZATION:** `admin` or `super_admin` with `aal2`.
- **CURRENT UI:** Dedicated tablet-optimized 60/40 split POS workspace at `/admin/pos` with search shortcut (`/`), category filters, tactile +/- steppers, customer details toggle, and complete sale button.
- **MISSING UI:** ESC/POS hardware receipt printer driver integration.
- **RECOMMENDED UI:** In-browser digital receipt and order history satisfy retail counter requirements cleanly.
