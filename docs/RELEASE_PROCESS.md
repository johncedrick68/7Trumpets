# Release Process

```text
feature branch
  -> typecheck
  -> lint
  -> tests
  -> production build
  -> accessibility checks
  -> migration ledger and dry-run review
  -> staging migrations
  -> protected preview deployment
  -> UAT and approval
  -> explicit production migration approval
  -> explicit production app deployment approval
  -> post-deploy smoke tests
```

`git push` never implies database migration. A successful preview never implies
production approval. Staging and production each require independently verified
environment identifiers before mutation.

Initial and ongoing privileged identity governance follows
[SUPER_ADMIN_PROVISIONING.md](./SUPER_ADMIN_PROVISIONING.md).

## Local and CI preflight

Run `npm run release:check`. It is non-destructive: it may validate source,
tests, build, accessibility, migration filenames, and local safety guards, but
must never push a database, deploy, merge, or seed a remote environment.

## Migration gates

1. Review purpose, dependencies, grants, RLS/security impact, locks, backward
   compatibility, recovery, and smoke checks.
2. Confirm the actual remote ledger using read-only tooling.
3. Rehearse from a clean local reset and run database tests.
4. Apply to staging only after explicit staging approval.
5. Complete preview UAT.
6. Obtain explicit production migration approval.
7. Apply migrations, then run their defined database smoke tests.
8. Deploy the compatible application and perform route/console/network smoke.

## Current pending production migrations

Read-only ledger snapshot on 2026-09-26: 33 local migrations, 27 applied to
linked project `eckhwcoigctkczzmkwqi`, and the following six pending. This is an
observation only and grants no migration approval.

| Migration | Purpose and dependencies | Security/locking/compatibility | Recovery and smoke |
| --- | --- | --- | --- |
| `20260922020000_public_catalog_availability.sql` | Adds a public, read-only availability projection over existing catalog/inventory state. | Explicit execute grants; no inventory mutation. Backward-compatible additive RPC. | Revoke/drop only before consumers depend on it; verify anon catalog availability and denied writes. |
| `20260923000000_authenticated_cart_add_boundary.sql` | Reconciles availability RPC and adds canonical authenticated cart-add behavior. Depends on cart/catalog tables. | Auth identity and stock boundary remain database-authoritative; row-level writes occur inside the RPC. | Retain prior application path until smoke passes; verify owner add, quantity accumulation, unavailable/over-stock rejection, and anonymous denial. |
| `20260923010000_pos_register_session_enforcement.sql` | Requires an owned OPEN register for counter sales. Depends on POS/order/inventory functions. | Locks the register row and preserves AAL2/role and idempotency guards. Changes rejection behavior for invalid sessions. | Do not bypass on failure; verify owned/open success, closed/unowned/missing rejection, duplicate idempotency, totals and inventory. |
| `20260924010000_store_settings_admin_grants.sql` | Restores least-privilege admin settings persistence. | Adds targeted grants while RLS/AAL2 remain authoritative; no delete grant. | Revoke targeted grants if necessary; verify admin save/reload and customer/anon denial. |
| `20260925010000_product_images_png_jpeg.sql` | Aligns product-media bucket MIME policy with validated PNG/JPEG/WebP upload code. | Storage policy metadata only; trusted writes and 5 MiB limit remain. | Restore the prior MIME array if rollback is required; verify valid PNG/JPEG/WebP and invalid/truncated/unsupported rejection. |
| `20260926010000_restore_paid_before_order_completion.sql` | Restores the database payment guard on `DELIVERED -> COMPLETED`. Depends on the expanded transition graph and canonical payments table. | Replaces the trigger function while preserving the current transition set; no grant/RLS change. Brief function-definition lock during migration; existing rows are not rewritten. | Forward-fix rather than rewriting history. Verify unpaid/missing-payment rejection with unchanged order state, paid COD/GCash/pickup/POS completion, direct-update enforcement, and illegal terminal-transition rejection. |

No item in this table authorizes applying a migration.

The regression repaired by `20260926010000` originated when
`20260920000000_domain_hierarchy_expansion.sql` replaced the complete order
transition trigger function to add pickup/POS transitions and unintentionally
omitted the older completion-payment guard. A clean migration replay plus
database invariant testing exposed it; commit `43e33985` contains the
forward-only repair. Function-replacement migrations must therefore prove both
their new behavior and all retained invariants.
