# 1968 V2 — Store Settings Contract

**Status:** Authoritative  
**Persistence Table:** `public.store_settings` (`key TEXT PRIMARY KEY, value JSONB, description TEXT, updated_by UUID, updated_at TIMESTAMPTZ`)  
**Authorization Gate:** Admin session with verified Multi-Factor Authentication (AAL2) via `requireAdminAal2("/admin/settings")`  

---

## 1. Persisted Store Settings Matrix

| Setting Key | Type | Fields & Data Contract | Validation Rules | Authorization | Consumer Surfaces |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`announcement`** | `JSONB Object` | `enabled`: `boolean`<br>`text`: `string`<br>`link`: `string` | `text` must be non-empty when `enabled` is `true`. `link` must be a valid relative path (`/products`) or absolute URL. | Admin AAL2 | Storefront global announcement banner (`src/components/announcement-bar.tsx`), Admin Settings. |
| **`hero`** | `JSONB Object` | `title`: `string`<br>`subtitle`: `string`<br>`cta_text`: `string`<br>`cta_link`: `string` | `title`, `cta_text`, and `cta_link` must be non-empty strings. | Admin AAL2 | Storefront homepage hero section, Admin Settings. |
| **`fulfillment`** | `JSONB Object` | `shipping_fee_minor`: `integer >= 0`<br>`free_shipping_threshold_minor`: `integer >= 0`<br>`allow_store_pickup`: `boolean`<br>`pickup_address`: `string` | Authoritative money values strictly in integer centavos (`₱150.00 = 15000`). No floating-point values. `pickup_address` required when `allow_store_pickup` is `true`. | Admin AAL2 | Server-side checkout calculation (`src/lib/checkout/`), Cart free-delivery badge, Admin Settings. |
| **`payment`** | `JSONB Object` | `gcash_enabled`: `boolean`<br>`gcash_number`: `string`<br>`gcash_account_name`: `string`<br>`gcash_qr_path`: `string`<br>`cod_enabled`: `boolean`<br>`cod_max_minor`: `integer >= 0` | At least one payment method must remain enabled. `cod_max_minor` in integer centavos (`₱10,000.00 = 1000000`). GCash number and account name required when `gcash_enabled` is `true`. | Admin AAL2 | Checkout payment options selector, Customer payment modal, Admin Payments review, Admin Settings. |

---

## 2. Dead / Retired Settings Excluded from UI

Per project governance guidelines and explicit instruction to remove dead UI:

1. **`ai_settings`**:
   - Seeded prototype for Gemini 3.8 Flash automated responses and n8n webhook routing.
   - **Status:** **RETIRED / EXCLUDED FROM UI**. No runtime automated response generation or unverified external webhook credentials may be displayed or edited in Admin Settings.
2. **Generic SaaS / Demo Controls**:
   - TailAdmin demo toggles for "Delete Organization", "Social Sign-in Links", "Team Seats", "Billing Plans", and fake webhook notifications are **EXCLUDED**.
   - Only settings with a verified database destination in `public.store_settings` and active server consumers are exposed in the interface.

---

## 3. Save & Mutation Semantics

- **Server Action:** `updateStoreSetting(formData: FormData)` in `src/lib/settings/actions.ts`.
- **Enforcement:**
  - Enforces `requireAdminAal2("/admin/settings")`.
  - Audits `updated_by` with the authenticated admin user ID.
  - Updates `updated_at` timestamp in PostgreSQL.
  - Revalidates cached Next.js paths: `/admin/settings`, `/`, `/products`, `/checkout`.
  - Performs canonical redirect with explicit feedback notices (`?notice=setting_updated` or `?error=...`).
