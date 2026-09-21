# 1968 Clothing — Gemini AI Safety, Privacy & Tool Boundaries

> Architectural safety policy governing the use of Google Gemini 3.8 Flash in 1968 Clothing.

---

## 1. Core Principles

1. **AI is an Assistant, Not the Authority**:
   - Consequential commerce actions (payments, money, refunds, role changes, inventory mutation) are authorized strictly by verified humans or PostgreSQL database contracts.
   - Gemini is strictly read-only and interpretive.
2. **Server-Only Boundary**:
   - `GEMINI_API_KEY` is kept exclusively on the server in untracked environment variables.
   - It is NEVER exposed to client components, browser JavaScript, or public repositories.
3. **Graceful Fallback**:
   - Customer support and core commerce operate with 100% functionality without Gemini.
   - If the API times out, rate limits, or errors, messages are preserved and queued for human staff (`WAITING_FOR_STAFF`).

---

## 2. Strict Tool Boundaries

### 2.1. Approved Read-Only Tools
The model can only query structured facts using application-validated, read-only tools:
- `get_customer_order_summary(order_id, customer_id)`: Validates ownership before returning order facts.
- `get_customer_tracking(order_id, customer_id)`: Returns official waybill URL and carrier status.
- `get_product_availability(slug_or_id)`: Checks active variant stock.
- `get_product_sizes(slug_or_id)`: Retrieves size guide dimensions.
- `get_store_policy(topic)`: Reads current policies from `store_settings`.
- `get_return_eligibility(order_id, customer_id)`: Verifies delivery window.

### 2.2. Strict Blacklist (Forbidden Tools)
The AI is **strictly prohibited** from having or invoking tools that can:
- ❌ Approve or reject GCash payments
- ❌ Issue refunds or adjustments
- ❌ Modify stock on hand or reservations
- ❌ Cancel arbitrary orders
- ❌ Modify user or staff roles
- ❌ Reset MFA factors or access credentials
- ❌ Execute raw or dynamic SQL

---

## 3. Data Minimization & Privacy

When communicating with Gemini:
- **Never Transmitted**:
  - Customer passwords, hashes, or auth tokens.
  - MFA seeds or recovery codes.
  - Supabase `service_role` keys or internal secrets.
  - Credit card or full bank account numbers.
  - Other customers' orders or data.
  - Private staff notes (`is_internal = true`).
- **Transmitted with Strict Scoping**:
  - Customer display name (first name / handle).
  - Sanitized customer inquiry message.
  - Order status and purchased garment names (only for the customer's own order).

---

## 4. Emergency Kill Switch

Super Administrators can immediately terminate all AI auto-replies and processing from `/admin/settings/ai`:
- Setting `kill_switch = true` stops all Gemini invocations instantly.
- Customer support automatically routes 100% of tickets to the human queue (`WAITING_FOR_STAFF`).
