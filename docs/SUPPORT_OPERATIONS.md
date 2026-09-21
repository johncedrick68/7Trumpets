# 1968 Clothing — Customer Support Operations Manual

> Operational handbook for customer support triage, AI handoff, internal staff notes, and ticket lifecycle.

---

## 1. Support Lifecycle & Ticket Statuses

```
[Customer Inquiry]
        │
        ▼
   [OPEN] ──(Inquiry eligible for AI auto-reply)──> [WAITING_FOR_CUSTOMER]
        │                                                    │
 (Dispute / Low confidence / Human request)                  ▼
        │                                           (Customer replies)
        ▼                                                    │
[WAITING_FOR_STAFF] <────────────────────────────────────────┘
        │
  (Staff takes over)
        │
        ▼
[STAFF_HANDLING]
        │
  (Staff resolves ticket)
        │
        ▼
   [RESOLVED] ──(Customer messages again)──> [OPEN]
```

### Status Definitions:
- **`OPEN`**: New inquiry received, waiting for initial triage or AI response.
- **`WAITING_FOR_CUSTOMER`**: Response sent (by AI or staff). Waiting for customer reply.
- **`WAITING_FOR_STAFF`**: Inquiry escalated due to payment dispute, refund request, low AI confidence, or explicit "Talk to a Person" request.
- **`STAFF_HANDLING`**: Staff member has actively claimed or replied to the thread.
- **`RESOLVED`**: Issue answered and completed. Automatically reopens if the customer messages again.
- **`CLOSED`**: Concluded ticket.

---

## 2. Public Replies vs. Private Internal Notes

In the Admin Support Inbox (`/admin/support`), staff can toggle between two modes:

1. **Public Reply**:
   - Transmitted directly to the customer's chat interface in real-time.
   - Updates conversation status to `WAITING_FOR_CUSTOMER`.
2. **Private Staff Note**:
   - Highlighted in distinct amber styling with an `INTERNAL STAFF NOTE` lock badge.
   - Strictly hidden from the customer via PostgreSQL Row Level Security (`is_internal = false`).
   - NEVER passed to Gemini AI prompts.
   - Used for team communication, delivery tracking investigation notes, or payment verification context.

---

## 3. Human Handoff & AI Auto-Reply Boundaries

- **Automated Responses**:
  - The AI assistant handles only low-risk, high-confidence queries: sizing questions, store policy FAQ, and basic tracking lookup.
- **Immediate Human Escalation**:
  - Payment disputes (claimed missing GCash proof, unexpected charges).
  - Refund requests or damaged garment claims.
  - Complaints or negative sentiment.
  - Explicit customer request ("I want to speak with an agent").
  - In all these cases, AI immediately pauses auto-replies (`ai_state = 'PAUSED_FOR_HUMAN'`) and flags the ticket as `WAITING_FOR_STAFF`.

---

## 4. Operational Best Practices

1. **Check Attached Order Facts**: When tickets are opened from Order Details, the real order number and fulfillment status appear directly in the conversation header.
2. **Review Advisory AI Summary**: If the conversation was initially analyzed by Gemini, review the advisory summary banner before replying.
3. **Internal Note on Resolution**: When resolving complex tickets, record a brief internal note explaining the resolution for historical accountability.

---

## 5. Operations Status Ledger

- **Customer Support Center (`/account/support`)**: `LIVE VERIFIED` (Tested with authenticated customer session; order-aware context functional).
- **Admin Support Inbox (`/admin/support`)**: `LIVE VERIFIED` (Two-pane queue triage, public replies, internal notes, resolution workflow).
- **Staff Assignment & Ticket Lifecycle RPCs**: `LIVE VERIFIED` (Guarded by AAL2 and audited in `public.audit_logs`).
- **Internal Staff Note Isolation**: `LIVE VERIFIED` (PostgreSQL RLS guarantees internal notes never leak to customers).
- **Customer Human Handoff Workflow**: `LIVE VERIFIED` (Single-click "Talk to a person" transitions to `WAITING_FOR_STAFF` and pauses AI).
- **Realtime Private Channel Synchronization**: `LIVE VERIFIED` (Channel `support:conversation:{id}` with reconnect refetch reconciliation).
- **AI Auto-Reply Service**: `IMPLEMENTED` / `CONFIGURATION REQUIRED` (Core service functional; live model calls require `GEMINI_API_KEY`).

