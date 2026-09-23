import Link from "next/link";

import { signInWithGoogle, signUp } from "@/lib/auth/actions";
import { AuthFrame } from "@/components/auth-frame";
import { GoogleIcon } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { AuthSubmitButton } from "@/components/auth-submit-button";

// Field-level inline error component
function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <p
      id={id}
      role="alert"
      aria-live="polite"
      className="flex items-start gap-1.5 text-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const params = await searchParams;
  const error = params.error;

  const emailError = error === "email" ? "Enter a valid email address." : null;
  const passwordError =
    error === "password" ? "Your password must contain at least 8 characters." : null;
  const confirmationError =
    error === "confirmation" ? "Passwords do not match." : null;
  const signupError =
    error === "signup"
      ? "An account with this email may already exist, or we could not create your account."
      : null;
  const oauthError =
    error === "oauth"
      ? "Google sign-up could not be completed. Try again or continue with email."
      : null;

  return (
    <AuthFrame>
      <div className="w-full">
        {/* Header */}
        <div className="mb-7">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Customer Account
          </p>
          <h1 className="mt-2 text-h2 text-foreground">Create Account</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Keep orders, delivery details, and support conversations in one place.
          </p>
        </div>

        <div className="space-y-5">
          {params.sent === "1" && (
            <Alert className="border-border">
              <AlertDescription>
                Check your email to confirm your account and finish registration.
              </AlertDescription>
            </Alert>
          )}

          {/* Social Auth */}
          <div className="space-y-2">
            <form action={signInWithGoogle}>
              <AuthSubmitButton pendingText="Connecting…" variant="outline" className="gap-3 border-border hover:bg-neutral-100 dark:hover:bg-neutral-900">
                <GoogleIcon size={17} />
                Continue with Google
              </AuthSubmitButton>
            </form>
            {oauthError && (
              <FieldError id="oauth-error" message={oauthError} />
            )}
          </div>

          {/* Separator */}
          <div className="flex items-center gap-3 my-5" aria-label="or register with email">
            <span className="h-px flex-1 bg-border" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              or register with email
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>

          {/* Registration Form */}
          <form action={signUp} className="space-y-4">
            {/* Email */}
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
                className="h-12 text-sm"
                aria-describedby={emailError ? "email-error" : undefined}
                aria-invalid={emailError ? true : undefined}
              />
              {emailError && <FieldError id="email-error" message={emailError} />}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="password" className="text-xs font-semibold text-foreground">
                  Password
                </Label>
                <span className="text-[11px] text-muted-foreground font-normal">
                  8+ characters
                </span>
              </div>
              <PasswordInput
                id="password"
                name="password"
                autoComplete="new-password"
                minLength={8}
                required
                placeholder="••••••••"
                aria-describedby={passwordError ? "password-error" : undefined}
                aria-invalid={passwordError ? true : undefined}
              />
              {passwordError && <FieldError id="password-error" message={passwordError} />}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm_password" className="text-xs font-semibold text-foreground">
                Confirm password
              </Label>
              <PasswordInput
                id="confirm_password"
                name="confirm_password"
                autoComplete="new-password"
                minLength={8}
                required
                placeholder="••••••••"
                aria-describedby={confirmationError ? "confirmation-error" : undefined}
                aria-invalid={confirmationError ? true : undefined}
              />
              {confirmationError && <FieldError id="confirmation-error" message={confirmationError} />}
            </div>

            {/* General server error — above Create Account */}
            {signupError && (
              <p
                id="signup-error"
                role="alert"
                aria-live="assertive"
                className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {signupError}
              </p>
            )}

            {/* Primary Action */}
            <div className="pt-1">
              <AuthSubmitButton pendingText="Creating account…">Create Account</AuthSubmitButton>
            </div>
          </form>
        </div>

        <p className="mt-8 border-t border-border pt-6 pb-2 text-sm text-center text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-foreground underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </AuthFrame>
  );
}
