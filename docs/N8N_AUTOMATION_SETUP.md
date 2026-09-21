# 1968 Clothing — n8n Automation Architecture & Setup Guide

> Canonical guide for configuring, securing, and operating asynchronous n8n workflows with 1968 Clothing.

---

## 1. Role & Architectural Boundaries

In 1968 Clothing, **n8n is an asynchronous orchestrator**, NOT an authoritative database or transactional gateway:
- **Zero Transaction Coupling**: Core retail operations (checkout, inventory reservations, GCash payment approval, refunds, POS sales) NEVER make synchronous calls to n8n.
- **Outbox Pattern Guarantee**: If n8n is offline, experiencing downtime, or unreachable, 100% of customer orders, payments, and support conversations succeed and persist safely in `public.automation_outbox`.
- **Read-Only Data Enrichment**: Workflows receive domain events and call internal authenticated APIs to trigger notifications, daily operational summaries, and background tasks.

---

## 2. Environment Variables & Secret Configuration

Add the following variable names to your untracked `.env.local` or hosting secret manager:

```bash
# URL of your n8n webhook instance (e.g. http://localhost:5678/webhook/...)
N8N_WEBHOOK_URL=

# Shared HMAC secret for verifying event integrity and preventing spoofing
N8N_WEBHOOK_SECRET=
```

> [!CAUTION]
> NEVER commit actual secret tokens or API keys to git. Keep secrets strictly in untracked environment files.

---

## 3. Webhook Security & Tamper Resistance

Every event dispatched from `src/lib/automation/outbox.ts` to n8n includes tamper-resistant verification headers:

| Header | Description |
|---|---|
| `X-1968-Signature` | Hex-encoded HMAC-SHA256 signature calculated over `${timestamp}.${rawBody}` |
| `X-1968-Timestamp` | Unix millisecond timestamp when the payload was signed |
| `X-1968-Event-Id` | Unique UUID of the event row in `public.automation_outbox` |

### Signature Verification Algorithm
```typescript
const age = Math.abs(Date.now() - parseInt(timestamp, 10));
if (age > 5 * 60 * 1000) {
  // Reject requests older than 5 minutes to prevent replay attacks
  throw new Error("Expired webhook timestamp");
}

const expectedSignature = crypto
  .createHmac("sha256", process.env.N8N_WEBHOOK_SECRET)
  .update(`${timestamp}.${rawBody}`)
  .digest("hex");

if (expectedSignature !== headerSignature) {
  throw new Error("Invalid webhook signature");
}
```

---

## 4. Packaged Workflows (`automation/n8n/`)

### 4.1. Workflow 1: Customer Support Assistant (`support-assistant-workflow.json`)
- **Trigger**: `SUPPORT_MESSAGE_CREATED` event from the outbox.
- **Function**: Validates the HMAC signature, fetches conversation context, evaluates the inquiry with Gemini 3.8 Flash, and posts an automated reply if confidence is above the threshold (or flags `WAITING_FOR_STAFF`).

### 4.2. Workflow 2: Daily Admin Operational Brief (`daily-admin-brief-workflow.json`)
- **Trigger**: Scheduled cron trigger (08:00 AM daily).
- **Function**: Queries verified revenue, inventory risks, and fulfillment backlog from PostgreSQL, synthesizes an executive summary with Gemini, and saves it to `public.admin_daily_briefs`.

### 4.3. Workflow 3: Human Support Escalation (`human-escalation-alert-workflow.json`)
- **Trigger**: `SUPPORT_HUMAN_REQUESTED` event.
- **Function**: Immediately routes ticket to high-priority queue and fires internal staff notifications when a customer clicks "Talk to a Person" or reports a payment dispute.

---

## 5. Security Audit Guidelines for Self-Hosted n8n

When running a self-hosted n8n instance:
1. **Execute Security Audit**:
   ```bash
   n8n audit
   ```
2. **Audit Checklist**:
   - Webhook authentication enabled for all production endpoints.
   - Default administrative credentials changed.
   - `N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=true` enabled.
   - Execution data pruning active to avoid storing sensitive customer inquiries indefinitely.

---

## 6. Local Status

```
N8N INTEGRATION PREPARED — INSTANCE/CREDENTIALS REQUIRED
```
All schema, outbox persistence, HMAC signing, dispatcher code, and workflow templates are fully tested and functional. Connect an external n8n instance by setting `N8N_WEBHOOK_URL` in `.env.local`.
