import Link from "next/link";
import { formatMinorUnitsToPHP } from "@/lib/catalog/queries";
import { getOrCreateCart, removeCartItem, updateCartItemQuantity } from "@/lib/cart/actions";
import { BagIcon, ShieldCheckIcon, ArrowRightIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Trash2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const cart = await getOrCreateCart();

  if (!cart) {
    return (
      <main className="w-full min-h-screen px-4 py-8 md:py-16 max-w-7xl mx-auto flex items-center justify-center">
        <Card className="w-full max-w-md text-center shadow-sm">
          <CardHeader className="space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <BagIcon size={32} />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">Sign in to view your bag</CardTitle>
            <CardDescription>
              Sign in with your account or Google to manage your streetwear pieces and proceed to checkout.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full flex gap-2 h-12" size="lg">
              <Link href="/login?next=/cart">
                <span>Sign In</span>
                <ArrowRightIcon size={16} />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="w-full min-h-screen px-4 py-8 md:py-12 max-w-7xl mx-auto">
      <header className="mb-8 md:mb-12">
        <p className="text-xs font-mono font-bold tracking-widest text-muted-foreground uppercase mb-2">
          Shopping Bag
        </p>
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">
          Your Bag ({cart.item_count} {cart.item_count === 1 ? "piece" : "pieces"})
        </h1>
      </header>

      {cart.items.length === 0 ? (
        <Card className="border-dashed py-16 text-center shadow-sm max-w-2xl mx-auto">
          <CardContent className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-2">
              <BagIcon size={40} />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Your bag is empty</h2>
            <p className="text-muted-foreground max-w-sm mb-4">
              Explore the latest 1968 Clothing archival collection drops.
            </p>
            <Button asChild size="lg" className="flex gap-2">
              <Link href="/products">
                Explore Collection <ArrowRightIcon size={16} />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Items List */}
          <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-4">
            {cart.items.map((item) => (
              <Card key={item.id} className="overflow-hidden shadow-sm">
                <CardContent className="p-0">
                  <div className="flex flex-col sm:flex-row p-4 sm:p-6 gap-6 items-start sm:items-center">
                    {/* Info */}
                    <div className="flex-1 space-y-2 w-full">
                      <h2 className="text-lg font-bold leading-tight">
                        <Link href={`/products/${item.product_slug}`} className="hover:underline hover:text-primary transition-colors">
                          {item.product_name}
                        </Link>
                      </h2>
                      <div className="flex flex-wrap gap-4 text-xs font-mono uppercase tracking-widest text-muted-foreground">
                        {item.variant_name && <span className="px-2 py-1 bg-muted rounded">Size: {item.variant_name}</span>}
                        <span className="px-2 py-1 bg-muted rounded">SKU: {item.sku}</span>
                      </div>
                      <div className="font-mono font-bold text-foreground pt-2">
                        {formatMinorUnitsToPHP(item.price_minor)} each
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto mt-4 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-0 border-border">
                      <form action={updateCartItemQuantity} className="flex items-center gap-2">
                        <input type="hidden" name="item_id" value={item.id} />
                        <Input
                          id={`qty-${item.id}`}
                          type="number"
                          name="quantity"
                          min="1"
                          max="99"
                          defaultValue={item.quantity}
                          className="w-16 h-10 text-center font-mono"
                        />
                        <Button type="submit" variant="secondary" size="sm" className="h-10 px-3 text-xs">
                          Update
                        </Button>
                      </form>

                      <div className="text-lg font-mono font-bold text-right min-w-[100px]">
                        {formatMinorUnitsToPHP(item.line_total_minor)}
                      </div>

                      <form action={removeCartItem}>
                        <input type="hidden" name="item_id" value={item.id} />
                        <Button type="submit" variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive w-10 h-10" title="Remove item">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </form>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Summary Sidebar */}
          <aside className="lg:col-span-5 xl:col-span-4 sticky top-6">
            <Card className="shadow-sm border-border">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-extrabold tracking-tight">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Subtotal ({cart.item_count} pieces)</span>
                  <strong className="font-mono">{formatMinorUnitsToPHP(cart.subtotal_minor)}</strong>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="text-muted-foreground italic">Calculated at checkout</span>
                </div>
                
                <Separator className="my-4" />
                
                <div className="flex justify-between items-end">
                  <span className="font-bold text-lg">Total Amount</span>
                  <strong className="text-2xl font-mono font-bold text-foreground">
                    {formatMinorUnitsToPHP(cart.subtotal_minor)}
                  </strong>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-3 pt-0">
                <Button asChild size="lg" className="w-full font-bold h-14 flex items-center justify-center gap-2 rounded-md">
                  <Link href="/checkout">
                    <span>Proceed to Checkout</span>
                    <ArrowRightIcon size={16} />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full h-12">
                  <Link href="/products">Continue Shopping</Link>
                </Button>
                
                <div className="flex items-center justify-center gap-2 mt-4 text-muted-foreground text-xs font-mono uppercase tracking-widest">
                  <ShieldCheckIcon size={14} />
                  <span>Encrypted checkout & GCash protection</span>
                </div>
              </CardFooter>
            </Card>
          </aside>
        </div>
      )}
    </main>
  );
}
