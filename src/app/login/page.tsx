import Link from "next/link";

import { signIn, signInWithGoogle } from "@/lib/auth/actions";
import { AuthFrame } from "@/components/auth-frame";
import { GoogleIcon } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string; signedOut?: string }> }) {
  const params = await searchParams;
  const errorMessage = params.error === "credentials" ? "The email or password is incorrect. Try again or reset your password." : params.error === "oauth" ? "Google sign-in could not be completed. Try email sign-in or check the provider configuration." : null;

  return (
    <AuthFrame>
      <div className="w-full max-w-md">
        <div className="mb-8">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Customer account</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-balance">Welcome back</h1>
          <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">Sign in to manage delivery details, review payment receipts, and track your orders.</p>
        </div>
        <div className="space-y-5">
          {params.signedOut === "1" && <Alert><AlertDescription>You have been signed out.</AlertDescription></Alert>}
          {errorMessage && <Alert variant="destructive"><AlertDescription>{errorMessage}</AlertDescription></Alert>}
          <form action={signInWithGoogle}><input type="hidden" name="next" value={params.next ?? "/account"} /><Button variant="outline" type="submit" className="h-12 w-full gap-3"><GoogleIcon size={17} />Continue with Google</Button></form>
          <div className="flex items-center gap-3" aria-label="or continue with email"><span className="h-px flex-1 bg-border" /><span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">or continue with email</span><span className="h-px flex-1 bg-border" /></div>
          <form action={signIn} className="space-y-5"><input type="hidden" name="next" value={params.next ?? "/account"} />
            <div className="space-y-2"><Label htmlFor="email">Email address</Label><Input id="email" name="email" type="email" autoComplete="email" maxLength={254} required placeholder="you@example.com" className="h-12" /></div>
            <div className="space-y-2"><div className="flex items-center justify-between gap-3"><Label htmlFor="password">Password</Label><Link href="/forgot-password" className="text-sm font-medium underline-offset-4 hover:underline">Forgot password?</Link></div><Input id="password" name="password" type="password" autoComplete="current-password" required placeholder="••••••••" className="h-12" /></div>
            <Button type="submit" className="h-12 w-full">Sign in</Button>
          </form>
        </div>
        <p className="mt-8 border-t border-border pt-6 text-sm text-muted-foreground">New to 1968 Clothing? <Link href="/signup" className="font-semibold text-foreground underline-offset-4 hover:underline">Create an account</Link></p>
      </div>
    </AuthFrame>
  );
}
