import Link from "next/link";

import { requestPasswordReset } from "@/lib/auth/actions";
import { AuthFrame } from "@/components/auth-frame";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string; sent?: string }> }) {
  const params = await searchParams;
  return <AuthFrame><div className="w-full max-w-md"><div className="mb-8"><p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Account recovery</p><h1 className="mt-3 text-4xl font-extrabold tracking-tight text-balance">Reset password</h1><p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">Enter your account email and we’ll send a secure link to set a new password.</p></div><div className="space-y-5">{params.sent === "1" && <Alert><AlertDescription>If an account exists for that email, a password reset link has been sent.</AlertDescription></Alert>}{params.error === "email" && <Alert variant="destructive"><AlertDescription>Enter a valid email address.</AlertDescription></Alert>}<form action={requestPasswordReset} className="space-y-5"><div className="space-y-2"><Label htmlFor="email">Email address</Label><Input id="email" name="email" type="email" autoComplete="email" maxLength={254} required placeholder="you@example.com" className="h-12" /></div><Button type="submit" className="h-12 w-full">Send reset link</Button></form></div><div className="mt-8 flex flex-wrap gap-x-5 gap-y-3 border-t border-border pt-6 text-sm"><Link href="/login" className="font-semibold text-foreground underline-offset-4 hover:underline">Back to sign in</Link><Link href="/signup" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Create account</Link></div></div></AuthFrame>;
}
