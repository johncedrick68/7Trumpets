import Link from "next/link";

import { signIn, signInWithGoogle } from "@/lib/auth/actions";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { AuthFrame } from "@/components/auth-frame";
import { GoogleIcon } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { AlertCircle } from "lucide-react";
import { AuthSubmitButton } from "@/components/auth-submit-button";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string; return_to?: string; signedOut?: string }> }) {
  const params = await searchParams;
  const next = safeRedirectPath(params.return_to ?? params.next, "/account");
  const isCredentialsError = params.error === "credentials";
  const oauthError = params.error === "oauth"
    ? "Google sign-in could not be completed. Try email sign-in or check the provider configuration."
    : null;

  return (
    <AuthFrame>
      <div className="w-full">
        <div className="mb-7">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Customer Account
          </p>
          <h1 className="mt-2 text-h2 text-foreground">
            Sign In
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Access your orders, saved addresses, and customer support.
          </p>
        </div>

        <div className="space-y-5">
          {params.signedOut === "1" && (
            <Alert className="border-border">
              <AlertDescription>You have been signed out.</AlertDescription>
            </Alert>
          )}

          {/* OAuth */}
          <form action={signInWithGoogle}>
            <input type="hidden" name="next" value={next} />
            <AuthSubmitButton pendingText="Connecting…" variant="outline" className="gap-2.5 border-border hover:bg-muted/40">
              <GoogleIcon size={17} />
              <span>Continue with Google</span>
            </AuthSubmitButton>
          </form>

          {oauthError && (
            <p
              id="oauth-error"
              role="alert"
              className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {oauthError}
            </p>
          )}

          <div className="flex items-center gap-3 my-5" aria-label="or continue with email">
            <span className="h-px flex-1 bg-border" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              or continue with email
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>

          {/* Email / Password Form */}
          <form action={signIn} className="space-y-4">
            <input type="hidden" name="next" value={next} />

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-foreground">
                Email address
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                maxLength={254}
                required
                placeholder="you@example.com"
                className="h-12 bg-background text-sm"
              />
            </div>

            {/* Password + inline credentials error + Sign In */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label
                  htmlFor="password"
                  className="text-xs font-semibold text-foreground"
                >
                  Password
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <PasswordInput
                id="password"
                name="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
                aria-describedby={isCredentialsError ? "login-error" : undefined}
                aria-invalid={isCredentialsError ? true : undefined}
              />
            </div>

            {/* Inline credentials error — between password and Sign In */}
            {isCredentialsError && (
              <p
                id="login-error"
                role="alert"
                aria-live="assertive"
                className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                The email or password is incorrect. Try again or reset your password.
              </p>
            )}

            {/* Primary Action */}
            <div className="pt-1">
              <AuthSubmitButton pendingText="Signing in…">Sign In</AuthSubmitButton>
            </div>
          </form>
        </div>

        <p className="mt-8 border-t border-border pt-6 pb-2 text-sm text-center text-muted-foreground">
          New to 1968 Clothing?{" "}
          <Link
            href="/signup"
            className="font-semibold text-foreground underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </p>
      </div>
    </AuthFrame>
  );
}
