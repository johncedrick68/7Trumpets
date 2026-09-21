import { updatePassword } from "@/lib/auth/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { AccountNavigation } from "@/components/account-navigation";
import { AuthSubmitButton } from "@/components/auth-submit-button";

export default async function UpdatePasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return (
    <main className="account-container page-section min-h-screen">
      <header className="mb-8">
        <p className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">Customer account</p>
        <h1 className="mt-1 text-h1">Security &amp; password</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage account authentication and password security.</p>
      </header>
      <AccountNavigation current="security" />
      <Card className="max-w-2xl border-border shadow-none">
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>Use at least 8 characters. This takes effect immediately for your account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {params.error === "password" && <Alert variant="destructive"><AlertDescription>Password must be at least 8 characters long.</AlertDescription></Alert>}
          {params.error === "update" && <Alert variant="destructive"><AlertDescription>Unable to update password. Check your session or request a new reset link.</AlertDescription></Alert>}
          <form action={updatePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <PasswordInput id="password" name="password" autoComplete="new-password" minLength={8} required placeholder="••••••••" />
            </div>
            <AuthSubmitButton pendingText="Updating password…" className="sm:w-auto">Update password</AuthSubmitButton>
          </form>
        </CardContent>
        <CardFooter className="border-t pt-6 text-sm text-muted-foreground">Keep your password private and avoid reusing it on other sites.</CardFooter>
      </Card>
    </main>
  );
}
