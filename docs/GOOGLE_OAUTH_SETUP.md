# Google OAuth Setup Guide — 1968 Clothing

This guide details the complete configuration required to enable Google OAuth for local development and hosted production environments.

---

## Architecture & Trust Boundary

Google OAuth uses the standard Authorization Code flow with PKCE:

```
Customer clicks "Continue with Google"
  ↓
Redirect to Google OAuth Consent Screen
  ↓
Google redirects to Supabase Auth Callback
  (Local: http://127.0.0.1:54321/auth/v1/callback)
  (Prod:  https://<project-ref>.supabase.co/auth/v1/callback)
  ↓
Supabase completes code exchange & redirects to Application Callback
  (Local: http://localhost:3000/auth/confirm?next=/account)
  ↓
Application exchanges session code via SSR client
  ↓
Customer session established with authenticated role
```

> [!IMPORTANT]
> Google OAuth authenticates identity only. It never automatically elevates a user to `admin` or `super_admin`. Staff access strictly requires authorization through the database-backed staff management boundary.

---

## 1. Google Cloud Console Configuration

1. Visit [Google Cloud Console — APIs & Services — Credentials](https://console.cloud.google.com/apis/credentials).
2. Click **Create Credentials** → **OAuth client ID**.
3. Set **Application type** to `Web application`.
4. Set **Name** to `1968 Clothing (Local Dev)`.

### Authorized JavaScript Origins
Add both:
- `http://localhost:3000`
- `http://127.0.0.1:3000`

### Authorized Redirect URIs
Add the **Supabase Auth callback URL**:
- Local Development: `http://127.0.0.1:54321/auth/v1/callback`

> [!CAUTION]
> Do NOT set the redirect URI to `/auth/confirm` in Google Cloud Console. Google must redirect to Supabase Auth first (`/auth/v1/callback`). Supabase then handles the OAuth handshake and redirects to the application's `/auth/confirm` endpoint.

---

## 2. Local Supabase Configuration

### Environment Variables
Store credentials in your untracked local environment (`.env.local` or host shell):

```bash
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID="<your-client-id>.apps.googleusercontent.com"
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET="<your-client-secret>"
```

> [!CAUTION]
> Never commit real Client Secrets or API keys to git. `.env.local` is gitignored.

### `supabase/config.toml`
The local configuration delegates credential lookup to environment variables:

```toml
[auth]
site_url = "http://127.0.0.1:3000"
additional_redirect_urls = [
  "http://127.0.0.1:3000/auth/confirm",
  "http://127.0.0.1:3000/update-password",
  "http://localhost:3000/auth/confirm",
  "http://localhost:3000/update-password",
]

[auth.external.google]
enabled = true
client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"
secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET)"
skip_nonce_check = false
email_optional = false
```

---

## 3. Restarting Local Supabase

After adding the environment variables and updating `config.toml`, restart local Supabase:

```bash
npx supabase stop
npx supabase start
```

---

## 4. Production Differences

When deploying to production:

| Setting | Local Development | Production |
|---|---|---|
| **App Origin** | `http://localhost:3000` | `https://1968clothing.com` |
| **Google JS Origin** | `http://localhost:3000` | `https://1968clothing.com` |
| **Supabase Callback** | `http://127.0.0.1:54321/auth/v1/callback` | `https://<project-ref>.supabase.co/auth/v1/callback` |
| **App Callback** | `http://localhost:3000/auth/confirm` | `https://1968clothing.com/auth/confirm` |
| **Provider Config** | Managed via `supabase/config.toml` | Configured in Supabase Dashboard → Authentication → Providers → Google |
| **Secrets** | `.env.local` (untracked) | Hosted Supabase Vault / Platform Secrets |

Never leave production auth dependent on `localhost` or `127.0.0.1`.
