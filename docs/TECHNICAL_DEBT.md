# Technical Debt

## Resolved

### Paid-before-completion invariant restored

- **Original impact:** after a clean replay, an unpaid `DELIVERED` order could
  transition to `COMPLETED` because a later trigger-function replacement added
  pickup/POS transitions but omitted an earlier payment guard.
- **Repair:** `20260926010000_restore_paid_before_order_completion.sql` restores
  the `PAID` requirement without changing the current legal transition graph.
- **Evidence:** clean migration replay succeeded; focused pgTAP coverage proves
  rejection and state preservation for unpaid/missing payments, successful COD,
  GCash, store-pickup and POS completion when paid, direct-update enforcement,
  and terminal-state rejection. The canonical POS register-session sale suite
  also passes.
- **Lesson:** a `CREATE OR REPLACE` migration owns the complete function body.
  Future transition expansions must copy every established guard and add clean-
  replay regression coverage for both new transitions and retained invariants.

### Supabase relation cardinality normalized at data boundaries

- **Original impact:** one-to-one embeds such as payments and inventory were
  observed as both objects and arrays, leaving components to interpret raw
  PostgREST shapes.
- **Repair:** explicit one/many relation adapters now normalize query results
  before rendering, with object, null, and historical array coverage.
- **Evidence:** relation-normalization and Admin functional-audit tests plus
  typecheck and route build verification.

## Critical

- None currently documented.

## External blocker

### External super-admin UAT environment unavailable

- **Impact:** `/admin/users` functional/logical evidence cannot be completed.
- **Evidence:** Supabase Branching returned entitlement-required; a separate
  free project returned the two-project account limit.
- **Recommendation:** provide a dedicated non-production Supabase project or
  enable Branching, then follow `SUPER_ADMIN_PROVISIONING.md`.
- **Why deferred:** it is an environment/governance prerequisite, not a code
  defect, and production cannot be used as a substitute.

## Active

### Automated admin axe login depends on a local TOTP seed

- **Impact:** resetting/re-enrolling the local factor invalidates unattended axe
  authentication until the ignored local credential is updated.
- **Evidence:** `scripts/admin-axe.mjs` requires `DEMO_ADMIN_TOTP_SECRET` for a
  verified factor.
- **Recommendation:** use an ephemeral local-only QA identity/factor lifecycle
  managed by a guarded harness, without printing or committing its seed.
- **Why deferred:** changing MFA fixture governance requires a dedicated review;
  weakening AAL2 is prohibited.

### Project status ledger is stale

- **Impact:** `PROJECT_STATUS.md` still describes 27 total migrations although
  five newer migrations exist locally and remain pending in production.
- **Recommendation:** update the status only when the release-governance owner
  approves a new canonical phase record.
- **Why deferred:** Phase I documents current truth without rewriting the
  existing phase-governance record implicitly.

### Large admin server pages combine query adaptation and presentation

- **Impact:** relation assumptions are harder to test in isolation.
- **Recommendation:** move only proven normalization seams into small query
  adapters; do not introduce an ORM or repository framework.

## Deferred

- Historical AI/automation columns and migrations remain intentionally because
  migration history and stored records are immutable. There is no active
  Gemini/n8n runtime to remove.
- Broader pagination beyond existing bounded admin queries should be driven by
  measured production volume rather than speculative optimization.
