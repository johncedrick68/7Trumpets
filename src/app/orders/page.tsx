import Link from "next/link";
import { redirect } from "next/navigation";
import { formatMinorUnitsToPHP } from "@/lib/catalog/queries";
import { deriveCustomerFulfillmentStage } from "@/lib/orders/status";
import { logServerError } from "@/lib/server-log";
import { createClient } from "@/lib/supabase/server";
import { PackageIcon, ArrowRightIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AccountNavigation } from "@/components/account-navigation";

export const dynamic = "force-dynamic";

export default async function OrderHistoryPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) {
    redirect("/login?next=/orders");
  }

  // Fetch all orders owned by user, sorted by placed_at descending
  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id, order_number, status, total_minor, placed_at, shipping_minor")
    .eq("user_id", userId)
    .order("placed_at", { ascending: false });

  if (ordersError) {
    logServerError("orders.list", "database_failure");
    throw new Error("ORDERS_UNAVAILABLE");
  }
  const orderList = orders || [];

  return (
    <main className="w-full min-h-screen px-4 py-8 md:py-12 max-w-5xl mx-auto">
      <div className="w-full">
        <header className="mb-8">
          <p className="text-xs font-mono font-bold tracking-widest text-muted-foreground uppercase">
            Customer Account
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight mt-1 mb-1">
            Order History
          </h1>
          <p className="text-sm text-muted-foreground">
            View and track your 1968 Clothing archival orders.
          </p>
        </header>

        <AccountNavigation current="orders" />

        {orderList.length === 0 ? (
          <Card className="border-dashed border-2 bg-muted/20 text-center py-16 px-6">
            <CardContent className="flex flex-col items-center p-0">
              <div className="mb-4 text-muted-foreground bg-muted p-4 rounded-full">
                <PackageIcon size={40} />
              </div>
              <h2 className="text-xl font-bold mb-2">No orders placed yet</h2>
              <p className="text-muted-foreground mb-6 text-sm">
                Explore our current Drop 01 streetwear releases.
              </p>
              <Button asChild className="gap-2">
                <Link href="/products">
                  <span>Explore Collection</span>
                  <ArrowRightIcon size={14} />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {orderList.map((order) => {
              const stageInfo = deriveCustomerFulfillmentStage(order.status);
              return (
                <Card key={order.id} className="border-border shadow-sm overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-3 mb-3">
                      <div>
                        <h2 className="text-lg font-bold">
                          <Link href={`/orders/${order.id}`} className="hover:underline decoration-2 underline-offset-4">
                            Order #{order.order_number}
                          </Link>
                        </h2>
                        <p className="text-xs font-mono text-muted-foreground mt-1">
                          Placed on{" "}
                          {new Date(order.placed_at).toLocaleDateString("en-PH", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                      <Badge variant="secondary" className="px-3 py-1 font-mono uppercase tracking-widest text-[10px]">
                        {stageInfo.label}
                      </Badge>
                    </div>

                    <p className="text-sm text-muted-foreground mb-6">
                      {stageInfo.description}
                    </p>

                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-4 border-t border-border">
                      <div>
                        <span className="text-xs text-muted-foreground font-mono uppercase tracking-widest mr-2">TOTAL:</span>
                        <strong className="text-lg font-mono">
                          {formatMinorUnitsToPHP(order.total_minor)}
                        </strong>
                      </div>
                      <Button variant="outline" size="sm" className="gap-2 w-full sm:w-auto group" asChild>
                        <Link href={`/orders/${order.id}`}>
                          <span>View Details & Tracking</span>
                          <ArrowRightIcon size={12} className="opacity-70 group-hover:opacity-100 transition-opacity" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
