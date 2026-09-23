import { redirect } from "next/navigation";
import { signOut, updateProfile } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { AccountNavigation } from "@/components/account-navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { deriveCustomerFulfillmentStage } from "@/lib/orders/status";

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

  const [{ data: recentOrders }, { data: defaultAddress }] = await Promise.all([
    supabase.from("orders").select("id, order_number, status, placed_at").eq("user_id", userId).order("placed_at", { ascending: false }).limit(3),
    supabase.from("addresses").select("id, label, recipient_name, address_line1, city_municipality, province").eq("user_id", userId).eq("is_default", true).maybeSingle(),
  ]);
  const activeOrder = recentOrders?.find((order) => !["DELIVERED", "CANCELLED", "DELIVERY_FAILED"].includes(order.status));

  const params = await searchParams;

  return (
    <main id="main-content" className="account-container page-section min-h-screen">
      <div className="w-full">
        {/* Header with User Info & Sign Out */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <p className="text-xs font-mono font-bold tracking-widest text-muted-foreground uppercase">
              Customer Account
            </p>
            <h1 className="text-h1 mt-1 mb-1">
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

        <section className="mb-8 grid gap-4 md:grid-cols-2" aria-label="Account overview">
          {activeOrder && (() => { const stage = deriveCustomerFulfillmentStage(activeOrder.status); return (
            <Card className="border-border bg-neutral-950 text-white">
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-3"><p className="text-xs font-bold uppercase tracking-wider text-white/60">Active order</p><Badge variant="secondary">{stage.label}</Badge></div>
                <h2 className="mt-3 text-lg font-semibold">Order #{activeOrder.order_number}</h2>
                <p className="mt-1 text-sm text-white/70">{stage.description}</p>
                <Button asChild variant="secondary" className="mt-5 w-full sm:w-auto"><Link href={`/orders/${activeOrder.id}`}>Track order →</Link></Button>
              </CardContent>
            </Card>
          ); })()}
          <Card className="border-border">
            <CardContent className="p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Default delivery address</p>
              {defaultAddress ? <><h2 className="mt-3 font-semibold">{defaultAddress.label || defaultAddress.recipient_name}</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{defaultAddress.address_line1}<br />{defaultAddress.city_municipality}, {defaultAddress.province}</p><Button asChild variant="outline" className="mt-5"><Link href="/account/addresses">Manage addresses</Link></Button></> : <><p className="mt-3 text-sm text-muted-foreground">No default address yet. Add one to make checkout faster.</p><Button asChild className="mt-5"><Link href="/account/addresses">Add address</Link></Button></>}
            </CardContent>
          </Card>
          {recentOrders && recentOrders.length > 0 && (
            <Card className="border-border md:col-span-2">
              <CardHeader><CardTitle className="text-base">Recent orders</CardTitle><CardDescription>Your latest purchases and current progress.</CardDescription></CardHeader>
              <CardContent className="divide-y p-0">
                {recentOrders.map((order) => { const stage = deriveCustomerFulfillmentStage(order.status); return <Link key={order.id} href={`/orders/${order.id}`} className="flex min-h-14 items-center justify-between gap-4 px-6 py-3 hover:bg-muted/40"><span className="font-medium">#{order.order_number}</span><span className="text-sm text-muted-foreground">{stage.label} →</span></Link>; })}
              </CardContent>
            </Card>
          )}
        </section>

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
        <Card className="border-border shadow-none">
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
