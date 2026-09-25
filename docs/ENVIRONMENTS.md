# Environments

Promotion and verification steps are defined once in
[RELEASE_PROCESS.md](./RELEASE_PROCESS.md); this document defines only the
environment boundaries those steps must respect.

## Local development

- Application: `127.0.0.1`/`localhost` only.
- Supabase: local CLI stack on loopback ports.
- Data: disposable synthetic fixtures.
- Local reset is allowed only after the target host is verified as loopback and
  the discarded QA state is recorded.

## Staging / UAT

Intended architecture:

```text
feature branch -> protected Vercel Preview -> dedicated non-production Supabase
```

Staging must have separate Database, Auth, Storage, API credentials, synthetic
data, and a legitimately provisioned super-admin with individual MFA. A preview
must never point to production Supabase during destructive or governance UAT.

Current reality (2026-09-25): unavailable. Supabase Branching is not entitled on
the current plan, and the owner has reached the active free-project limit. Phase
G `/admin/users` super-admin AAL2 UAT therefore remains externally blocked.

## Production

- Contains real identities and business data.
- Is never a QA substitute.
- Migrations, Auth/role changes, and application deployment require explicit,
  separately recorded approval.

## Environment variables

The repository uses `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in browser-safe contexts, and
`SUPABASE_SECRET_KEY` only on trusted server boundaries. OAuth provider secrets
are server/config values. Service credentials, database passwords, TOTP seeds,
and verification codes must never appear in `NEXT_PUBLIC_*`, source control, or
logs.
