import { updatePassword } from "@/lib/auth/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AccountNavigation } from "@/components/account-navigation";

export default async function UpdatePasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8 md:py-12">
      <header className="mb-8">
        <p className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">Customer account</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Security &amp; password</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage account authentication and password security.</p>
      </header>
      <AccountNavigation current="security" />
      <Card className="max-w-2xl border-border shadow-sm">
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
              <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required placeholder="••••••••" />
            </div>
            <Button type="submit" className="w-full sm:w-auto">Update password</Button>
          </form>
        </CardContent>
        <CardFooter className="border-t pt-6 text-sm text-muted-foreground">Keep your password private and avoid reusing it on other sites.</CardFooter>
      </Card>
    </main>
  );
}
