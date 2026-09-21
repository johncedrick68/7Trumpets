import Link from "next/link";

import { requestPasswordReset } from "@/lib/auth/actions";
import { AuthFrame } from "@/components/auth-frame";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthSubmitButton } from "@/components/auth-submit-button";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const params = await searchParams;

  return (
    <AuthFrame>
      <div className="w-full">
        {/* Header Block */}
        <div className="mb-6">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Account Recovery
          </p>
          <h1 className="mt-2 text-h2 text-foreground">
            Reset password
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Enter your account email and we’ll send a secure link to set a new password.
          </p>
        </div>

        <div className="space-y-5">
          {params.sent === "1" && (
            <Alert className="border-border">
              <AlertDescription>
                If an account exists for that email, a password reset link has been sent.
              </AlertDescription>
            </Alert>
          )}

          {params.error === "email" && (
            <Alert variant="destructive">
              <AlertDescription>Enter a valid email address.</AlertDescription>
            </Alert>
          )}

          <form action={requestPasswordReset} className="space-y-4">
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
              />
            </div>

            <div className="pt-2">
              <AuthSubmitButton pendingText="Sending link…">Send Reset Link</AuthSubmitButton>
            </div>
          </form>
        </div>

        <div className="mt-8 flex items-center justify-between border-t border-border pt-6 pb-2 text-sm">
          <Link
            href="/login"
            className="font-semibold text-foreground underline-offset-4 hover:underline"
          >
            ← Back to sign in
          </Link>
          <Link
            href="/signup"
            className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Create account
          </Link>
        </div>
      </div>
    </AuthFrame>
  );
}
