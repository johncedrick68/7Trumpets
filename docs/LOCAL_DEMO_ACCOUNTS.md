# Local Demo Accounts

> [!CAUTION]
> **LOCAL DEVELOPMENT ONLY** — These credentials exist only in the local
> Supabase instance. Never use or share them on production.

---

## Setup

### Prerequisites

1. Local Supabase running:
   ```
   supabase start
   ```
2. `.env.local` present with `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SECRET_KEY`
3. Catalog seeded (if not already):
   ```
   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f scripts/seed-1968-catalog.sql
   ```

### Create / Reset Demo Accounts

Step 1 — Create auth users:
```bash
node scripts/create-demo-users.mjs
```

Step 2 — Fix profiles and roles (idempotent):
```bash
# These must run separately via npx supabase db query --local
# because the Supabase REST API cannot access the private schema
# Replace UUIDs with the output of Step 1 if different

npx supabase db query --local "UPDATE public.profiles SET display_name = 'Demo Customer', phone = '0917 000 0001' WHERE id = 'eb9ed50f-2d1f-4974-aca1-683df899ea98'"
npx supabase db query --local "UPDATE public.profiles SET display_name = 'Demo Admin', phone = '0917 000 0002' WHERE id = '7cceb483-5ac3-4a91-b5c1-e7a8a61b95af'"
npx supabase db query --local "DELETE FROM private.user_roles WHERE user_id = '7cceb483-5ac3-4a91-b5c1-e7a8a61b95af'"
npx supabase db query --local "INSERT INTO private.user_roles (user_id, role) VALUES ('7cceb483-5ac3-4a91-b5c1-e7a8a61b95af', 'admin') ON CONFLICT DO NOTHING"
npx supabase db query --local "INSERT INTO public.addresses (user_id, label, recipient_name, phone, address_line1, city_municipality, province, postal_code, is_default) VALUES ('eb9ed50f-2d1f-4974-aca1-683df899ea98', 'Home', 'Demo Customer', '09170000001', '123 Demo Street, Barangay Sample', 'Manila', 'Metro Manila', '1000', true) ON CONFLICT DO NOTHING"
```

Step 3 — Verify:
```bash
npx supabase db query --local "SELECT u.email, p.display_name, r.role FROM auth.users u JOIN public.profiles p ON p.id = u.id JOIN private.user_roles r ON r.user_id = u.id WHERE u.email IN ('customer.demo@1968.local', 'admin.demo@1968.local') ORDER BY u.email"
```

Expected output: two rows — `admin.demo@1968.local` (admin) and `customer.demo@1968.local` (customer).

> [!NOTE]
> The script creates accounts with email confirmation bypassed. Auth user UUIDs
> are stable across re-runs (same account is reused). If you do a `supabase db reset`,
> re-run both steps to recreate the accounts.

---

## Customer Demo Account

| Field | Value |
|---|---|
| Email | `customer.demo@1968.local` |
| Password | `Demo1968Customer!` |
| User ID | `eb9ed50f-2d1f-4974-aca1-683df899ea98` (local only) |
| Role | `customer` |
| MFA | Not required |
| Fixtures | Saved address (Manila) |

### Customer QA Routes

| Route | Expected |
|---|---|
| `/login` | Sign in successfully |
| `/account` | Account overview |
| `/account/addresses` | Shows demo Manila address |
| `/products` | Browse catalog |
| `/products/tenets-2` | PDP with size selector |
| `/cart` | Add items → view cart |
| `/checkout` | Fill COD or GCash |
| `/orders` | Order history |
| `/orders/[id]` | Order detail + receipt upload |

---

## Admin Demo Account

| Field | Value |
|---|---|
| Email | `admin.demo@1968.local` |
| Password | `Demo1968Admin!` |
| User ID | `7cceb483-5ac3-4a91-b5c1-e7a8a61b95af` (local only) |
| Role | `admin` |
| MFA | **Required — must be enrolled manually** |

### MFA / AAL2 Enrollment (Required Before Admin Access)

The script creates the admin account but **cannot pre-enroll TOTP**. You must
enroll MFA legitimately after first login:

1. **Sign in** at `/login` with `admin.demo@1968.local` / `Demo1968Admin!`
2. Navigate to **`/admin-mfa`** (or the MFA enrollment page in the app)
3. **Scan the QR code** displayed with a TOTP app (e.g. Google Authenticator,
   Authy, 1Password, Bitwarden)
4. **Enter the 6-digit code** to confirm enrollment
5. **Sign out**, then sign back in
6. When prompted, **enter the TOTP code** to reach AAL2
7. Navigate to **`/admin`** — access should now be granted

> [!IMPORTANT]
> If AAL2 is not achieved, `/admin` will redirect to the MFA challenge page.
> Do NOT add any dev bypass for MFA — this is correct security behavior.

### Admin QA Routes (after AAL2)

| Route | Expected |
|---|---|
| `/admin` | Dashboard |
| `/admin/orders` | Order management queue |
| `/admin/payments` | GCash payment review |
| `/admin/catalog` | Product and inventory management |
| `/admin/audit` | Audit log |
| `/admin/pos` | POS entry |

---

## Reset

To reset passwords or recreate accounts, simply re-run:

```bash
node scripts/create-demo-users.mjs
```

To fully wipe and re-seed the local database:

```bash
supabase db reset
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f scripts/seed-1968-catalog.sql
node scripts/create-demo-users.mjs
```

---

## Notes

- These credentials are stored in `scripts/create-demo-users.mjs`.
- The script reads `SUPABASE_SECRET_KEY` from `.env.local` which is
  `.gitignore`d and never committed.
- The script refuses to run if `NEXT_PUBLIC_SUPABASE_URL` does not point to
  `127.0.0.1` or `localhost`.
- **Never** commit real production credentials to source control.
