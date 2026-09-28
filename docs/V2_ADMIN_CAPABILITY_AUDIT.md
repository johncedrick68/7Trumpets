# 1968 V2 — Admin Capability & Domain Audit

**Date:** 2026-09-28  
**Scope:** V1 Reference Audit (`C:\xampp\htdocs\7trumpets`) vs. V2 Implementation (`C:\xampp\htdocs\7trumpets-v2`)  
**Status:** Canonical Truth Baseline  

---

## Executive Summary

Before undertaking the TailAdmin structural rebuild for Admin V2, this audit separates verified database-backed capabilities from aspirational claims, marketing copy, or unverified frontend summaries. 

All Admin V2 interfaces must adapt strictly to **verified database invariants and existing server RPCs**. No speculative features, mock data, or phantom database fields may be introduced into the admin UI.

---

## Audit Matrix

| Claimed Capability | Status | Evidence in V1 Codebase & Schema | V2 Operational Rule |
| :--- | :---: | :--- | :--- |
| **1. Specific Garment GSM / Material Claims** (e.g. 240 GSM, combed cotton) | **UNSUPPORTED CLAIM** | No GSM or fabric material columns exist in `public.products` (`id`, `category_id`, `name`, `slug`, `status`, `description`, `created_at`). Description contains raw text entered by staff, but there is no structured field or database constraint for GSM. | Do not create dedicated GSM/fabric badge widgets or schema fields in Catalog. Preserve description as standard multiline text. |
| **2. "Born in San Roque" Tagline** | **PARTIAL** | `San Roque Collection` exists as an active database category (`c1000000-0000-0000-0000-000000000002`) and products (`San Roque Black`, `San Roque White`, etc. in `seed.sql`), and product imagery includes San Roque fiesta graphics. However, "Born in San Roque" is not an official system constant or brand tagline constraint. | Reference the actual `San Roque Collection` category where applicable. Do not hardcode "Born in San Roque" as fixed administrative system chrome. |
| **3. Barcode Scanning** | **NOT IMPLEMENTED** | No camera scanner, hardware wedge scanner driver, or barcode rendering library (e.g., JsBarcode) exists. In V1 POS (`pos-terminal.tsx`), there is a text SKU search input and an order number formatted as `*ORD-YYYYMMDD-XXXXX*` in monospace font for optical reference on print slips. | Treat product search as text/SKU search. Do not render fake "Scan Barcode" camera modals until a real browser scanner API or hardware wedge parser is implemented. |
| **4. Thermal Receipt Printing** | **PARTIAL** | V1 `pos-terminal.tsx` contains a printable receipt dialog styled with `@media print` CSS targeting 80mm width and triggers `window.print()`. There is no direct ESC/POS hardware socket or Bluetooth printer driver. | Retain the browser print modal styled for standard 80mm thermal receipt roll layout via `@media print`. Do not claim ESC/POS hardware integration. |
| **5. Exact Number of Operational Order Queues (10 Queues)** | **PARTIAL** | The `public.orders` table enforces 11 canonical statuses: `CONFIRMED`, `PROCESSING`, `PACKING`, `READY_FOR_SHIPMENT`, `SHIPPED`, `IN_TRANSIT`, `OUT_FOR_DELIVERY`, `DELIVERED`, `COMPLETED`, `CANCELLED`, `DELIVERY_FAILED`. The test suite references "10 queues and metrics" as a high-level aggregate covering payments review, dispatch queues, returns, and delivery exceptions. | Model order navigation and filters strictly around actual database order statuses and operational queries (`/admin/orders?status=...`). Avoid building 10 arbitrary tab screens if they map to the same underlying status filter. |
| **6. Staff Support Assignment** | **VERIFIED** | PostgreSQL RPC `public.admin_assign_staff(p_conversation_id UUID, p_staff_id UUID)` is implemented in migration `20260922010000_support_security_hardening.sql`, verified in `tests/support-ai-staff.test.mjs`, and gated to AAL2 sessions. Columns `assigned_staff_id` and foreign key to `auth.users` exist on `support_conversations`. | Support staff assignment is fully real and backed by AAL2 RPC. Reusable staff selector dropdown is authorized. |
| **7. Internal Support Notes** | **VERIFIED** | `public.support_messages` includes `is_internal BOOLEAN NOT NULL DEFAULT false`. Enforced by PostgreSQL RLS: non-staff customers cannot select or insert messages where `is_internal = true`. Staff AAL2 RPC `admin_reply_support` accepts `p_is_internal BOOLEAN`. | Support inbox preserves dual message types: public customer replies vs internal staff notes with distinct visual treatment. |
| **8. Real-time Support Sync** | **VERIFIED** | `support-inbox.tsx` and `support-center-client.tsx` subscribe to Supabase Realtime via `supabase.channel('support:conversation:{id}')` on PostgreSQL `INSERT` events on `support_messages`, with automatic DB refetch reconciliation upon reconnect. | Real-time support messaging is fully supported and verified; use optimistic deduplication and channel cleanup. |
| **9. Specific Customer Order Timeline** | **VERIFIED** | Canonical mapping in `src/lib/orders/status.ts` strictly maps authoritative order statuses to 5 customer-facing stages: `CONFIRMED` (1), `PREPARING` (2), `SHIPPING` (3), `ARRIVING` (4), `DELIVERED` (5), with `CANCELLED` and `DELIVERY_FAILED` handled as distinct exception states. | Retain this exact 5-stage timeline helper; never duplicate or alter order statuses in PostgreSQL to mimic presentation steps. |
| **10. Low-Stock Thresholds** | **VERIFIED** | `public.inventory` contains `safety_stock INTEGER NOT NULL DEFAULT 0` with invariant `CHECK (reserved + safety_stock <= on_hand)`. Available stock is authoritatively calculated as `on_hand - reserved - safety_stock`. Low stock is defined as `available <= safety_stock`. | Low-stock badges and alerts in the overview and catalog must strictly use `safety_stock` from the database, not arbitrary client-side magic numbers. |
| **11. Inventory Adjustment Reasons** | **VERIFIED** | `public.inventory_movements` table enforces `movement_type IN ('reservation_created', 'reservation_consumed', 'reservation_released', 'reservation_expired', 'adjustment', 'restock')` and records `reason TEXT`. RPC `public.admin_adjust_inventory` accepts `p_type` ('adjustment' or 'restock') and `p_reason`. | Stock adjustments must strictly require `type` and non-empty `reason` string, generating immutable audit ledger rows. |
| **12. Cashier Role** | **VERIFIED** | `private.user_roles` check constraint: `CHECK (role IN ('customer', 'cashier', 'admin', 'super_admin'))`. Added in migration `20260920000000_domain_hierarchy_expansion.sql` and enforced across RLS policies. | The admin user management and access control strictly recognize `cashier` as a first-class operational role alongside `admin` and `super_admin`. |
| **13. Specific POS Functionality** | **VERIFIED** | Register shifts (`register_sessions` table) with opening cash, expected cash, actual cash counting, shift status (`OPEN`, `CLOSED`), POS counter sales via atomic RPC `pos_counter_sale`, and active session enforcement (`20260923010000_pos_register_session_enforcement.sql`) are fully implemented and tested. | POS maintains its dedicated shift-enforced operational workflow rather than generic dashboard cards. |

---

## Directives for Admin V2 Build

1. **Catalog & Products:** Do not invent structured material or GSM fields. Expose verified fields: Title, Slug, Category, Description, Status (`draft`, `published`, `archived`), Images, Variants (SKU, Price, Compare-at Price, Status), and Inventory (`on_hand`, `reserved`, `safety_stock`).
2. **Inventory Stock Actions:** Connect directly to `admin_adjust_inventory` requiring variant ID, quantity delta ($\pm$), movement type (`adjustment` or `restock`), and a mandatory traceable reason.
3. **Overview Metrics:** Only display metrics derived from real database queries (`orders`, `payments`, `inventory`, `return_requests`, `audit_logs`). Reject placeholder trends, fake conversion percentages, or SaaS subscription graphs.
4. **Order Statuses:** Group orders around canonical statuses: `CONFIRMED`, `PROCESSING`, `PACKING`, `READY_FOR_SHIPMENT`, `SHIPPED`, `IN_TRANSIT`, `OUT_FOR_DELIVERY`, `DELIVERED`, `COMPLETED`, `CANCELLED`, `DELIVERY_FAILED`.
5. **POS & Cashier:** Preserve the verified register shift lifecycle (`open_register_session`, `pos_counter_sale`, `close_register_session`) and printable thermal slip format.
