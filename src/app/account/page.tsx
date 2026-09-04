import { redirect } from "next/navigation";
import { signOut, updateProfile } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { AccountNavigation } from "@/components/account-navigation";

export const dynamic = "force-dynamic";
// Shared navigation includes /orders, /account/addresses, and /update-password.

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; password?: string; saved?: string }>;
}) {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) redirect("/login?next=/account");

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user || userData.user.id !== userId) {
    redirect("/login?next=/account");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("display_name, phone")
    .eq("id", userId)
    .single();

  const params = await searchParams;

  return (
    <main className="w-full min-h-screen px-4 py-8 md:py-12 max-w-5xl mx-auto">
      <div className="w-full">
        {/* Header with User Info & Sign Out */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <p className="text-xs font-mono font-bold tracking-widest text-muted-foreground uppercase">
              Customer Account
            </p>
            <h1 className="text-3xl font-extrabold tracking-tight mt-1 mb-1">
              Account Settings
            </h1>
            <p className="text-sm text-muted-foreground">
              Signed in as <strong className="text-foreground">{userData.user.email}</strong>
            </p>
          </div>

          <form action={signOut}>
            <Button variant="outline" type="submit">
              Sign Out
            </Button>
          </form>
        </div>

        <AccountNavigation current="profile" />

        {params.saved === "1" && (
          <div className="p-4 text-sm text-green-800 bg-green-50 rounded-md border border-green-200 mb-6" role="status">
            Profile details updated successfully.
          </div>
        )}
        {params.password === "updated" && (
          <div className="p-4 text-sm text-green-800 bg-green-50 rounded-md border border-green-200 mb-6" role="status">
            Password changed successfully.
          </div>
        )}
        {(params.error || profileError || !profile) && (
          <div className="p-4 text-sm text-red-800 bg-red-50 rounded-md border border-red-200 mb-6" role="alert">
            We could not load or save your profile. Please check your connection.
          </div>
        )}

        {/* Profile Card */}
        <Card className="shadow-sm border-border">
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>
              Update your contact details for delivery confirmations.
            </CardDescription>
          </CardHeader>

          {profile && (
            <form action={updateProfile}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="display_name">Full Name / Display Name</Label>
                  <Input
                    id="display_name"
                    name="display_name"
                    autoComplete="name"
                    maxLength={100}
                    defaultValue={profile.display_name ?? ""}
                    placeholder="Juan Dela Cruz"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    maxLength={32}
                    defaultValue={profile.phone ?? ""}
                    placeholder="e.g. 0917 123 4567"
                  />
                </div>
              </CardContent>

              <CardFooter className="flex justify-end pt-4 border-t border-border mt-4">
                <Button type="submit">
                  Save Changes &rarr;
                </Button>
              </CardFooter>
            </form>
          )}
        </Card>
      </div>
    </main>
  );
}
