# Initial Super-Administrator Provisioning

## Current status

The application does not contain a runtime path for creating the first
`super_admin`. This is intentional: ordinary customers and administrators must
never be able to promote themselves. The database role-management RPC also
requires an existing `super_admin` with an AAL2 session.

The architecture reserves initial provisioning for a one-time, trusted
owner/operator transaction against an exact Supabase Auth user UUID. The
repository currently does not provide an executable bootstrap script or a
completed environment-specific runbook for that transaction. Until an
authorized operator completes and records that process in an isolated
environment, super-admin UI UAT remains blocked.

## Governance requirements

- **Authorized operator:** the named project owner or a specifically delegated
  database security operator. An ordinary application administrator is not an
  authorized bootstrap operator.
- **Execution location:** a protected Supabase project-owner or direct database
  administration session for the intended environment, never an application
  route, browser console, client API, or service-role workaround.
- **Target identity:** an already-created, verified Supabase Auth user whose
  exact UUID and owner authorization have been independently confirmed.
- **Operator authentication:** the operator must use their normal protected
  project-owner access, including MFA where available. Shared credentials are
  prohibited.
- **Transaction:** the initial role assignment and its audit evidence must be
  performed atomically. No production identity, credential, TOTP secret, or
  environment-specific UUID may be stored in migrations or source control.
- **Evidence:** retain the approved change record, operator identity, target Auth
  UUID, environment, timestamp, transaction result, and corresponding immutable
  audit evidence. Never record a TOTP seed or verification code.

## Identity activation and MFA

After the trusted role assignment, the target user must:

1. Sign in through the normal application authentication flow at AAL1.
2. Confirm that protected Admin access routes to MFA and that AAL2-only actions
   remain unavailable.
3. Enroll an individual supported MFA factor through the normal Supabase MFA
   flow. Do not share or pre-seed a TOTP secret.
4. Complete a real challenge and verification.
5. Confirm the canonical assurance result reports `currentLevel = aal2` and
   `nextLevel = aal2` before performing super-admin operations.

## Ongoing role governance

Once the first legitimate super-admin exists, all subsequent admin and
super-admin assignments must use the application's `manage_user_role` boundary
or the staff-invitation workflow. These paths require an authenticated AAL2
super-admin, validate supported roles, preserve the last super-admin, and write
audit evidence. UI visibility is not authorization; direct insufficient-role
and AAL1 requests must continue to fail at the server/database boundary.

## Recovery

- Maintain at least two independently controlled super-admin identities before
  relying on self-service role recovery.
- A surviving AAL2 super-admin should perform ordinary role or MFA recovery
  through the supported application workflow.
- If no legitimate super-admin remains, stop application-level recovery. A
  project owner must authorize a new controlled owner/operator transaction with
  the same identity verification and audit requirements as initial provisioning.
- Never recover access by editing JWT claims, disabling MFA or RLS, exposing a
  bootstrap endpoint, or allowing an ordinary admin to self-promote.

## Required staging UAT

Before `/admin/users` is marked functionally complete, use a legitimately
provisioned non-production identity to verify:

- ordinary-admin UI restrictions and direct RPC rejection;
- super-admin AAL1 rejection or MFA routing;
- real MFA verification and AAL2 confirmation;
- `/admin/users` controls at AAL2;
- valid role assignment persistence after reload;
- invalid and protected transition rejection;
- self-protection and last-super-admin protection;
- MFA-sensitive mutation behavior; and
- the expected immutable audit-log entries.

