import Link from "next/link";
import Image from "next/image";
import { formatMinorUnitsToPHP } from "@/lib/catalog/queries";
import { getOrCreateCart, removeCartItem, updateCartItemQuantity } from "@/lib/cart/actions";
import { BagIcon, ArrowRightIcon, ShieldCheckIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2 } from "lucide-react";
import { getStoreSetting } from "@/lib/settings/queries";
import { calculateShippingMinor } from "@/lib/checkout/shipping";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const [cart, fulfillmentSettings] = await Promise.all([
    getOrCreateCart(),
    getStoreSetting<{ shipping_fee_minor: number; free_shipping_threshold_minor?: number }>(
      "fulfillment",
      { shipping_fee_minor: 15000, free_shipping_threshold_minor: 350000 },
    ),
  ]);

  if (!cart) {
    return (
      <main id="main-content" className="transaction-container page-section min-h-[60vh]">
        <header className="mx-auto mb-8 max-w-xl text-center">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            Shopping bag
          </p>
          <h1 className="mt-2 text-h1 text-foreground">
            Your bag is waiting
          </h1>
        </header>
        <div className="mx-auto w-full max-w-md text-center">
          <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <BagIcon size={24} />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Sign in to access your bag</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Use your account or Google to review saved items and continue to checkout.
          </p>
          <Button asChild className="mt-6 h-12 w-full gap-2 bg-neutral-950 font-semibold text-white hover:bg-neutral-800" size="lg">
            <Link href="/login?next=/cart">
              <span>Sign In</span>
              <ArrowRightIcon size={16} />
            </Link>
          </Button>
          <Link href="/products" className="mt-4 inline-flex min-h-11 items-center justify-center text-sm font-semibold text-foreground underline-offset-4 hover:underline">
            Continue shopping
          </Link>
        </div>
      </main>
    );
  }

  const shippingMinor = calculateShippingMinor(cart.subtotal_minor, "SHIPMENT", fulfillmentSettings);
  const totalMinor = cart.subtotal_minor + shippingMinor;

  return (
    <main id="main-content" className="transaction-container page-section min-h-screen">
      {/* Page Header */}
      <header className="mb-8 md:mb-10">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          Shopping Bag
        </p>
        <h1 className="mt-1 text-h1 text-foreground">
          Your Bag ({cart.item_count} {cart.item_count === 1 ? "piece" : "pieces"})
        </h1>
      </header>

      {cart.items.length === 0 ? (
        <div className="py-20 text-center max-w-lg mx-auto rounded-xl border border-border border-dashed bg-muted/10 p-8">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground mx-auto mb-4">
            <BagIcon size={32} />
          </div>
          <h2 className="text-h2 text-foreground">Your shopping bag is empty</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-6 leading-relaxed">
            Explore the latest 1968 Clothing archival drop pieces and find your fit.
          </p>
          <Button asChild size="lg" className="bg-neutral-950 text-white hover:bg-neutral-800 font-semibold px-6">
            <Link href="/products" className="flex items-center gap-2">
              <span>Explore Collection</span>
              <ArrowRightIcon size={16} />
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Cart Items List */}
          <div className="lg:col-span-7 xl:col-span-8 divide-y divide-border border-y border-border">
            {cart.items.map((item) => (
              <div
                key={item.id}
                className="py-6 flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between"
              >
                <div className="flex gap-4 sm:gap-5 items-start w-full sm:w-auto">
                  {/* Item Image Thumbnail */}
                  <Link
                    href={`/products/${item.product_slug}`}
                    className="relative w-20 h-24 sm:w-24 sm:h-28 rounded-md bg-neutral-100 dark:bg-neutral-900 overflow-hidden border border-border/60 shrink-0 block"
                    aria-label={item.product_name}
                  >
                    <Image
                      src={item.image_path || "/images/1968%20CLOTHING%20V1.webp"}
                      alt={item.product_name}
                      fill
                      sizes="96px"
                      className="object-cover object-center"
                    />
                  </Link>

                  {/* Item Details */}
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <h2 className="text-body font-bold text-foreground">
                      <Link
                        href={`/products/${item.product_slug}`}
                        className="hover:underline underline-offset-4"
                      >
                        {item.product_name}
                      </Link>
                    </h2>

                    <div className="flex items-center gap-2 flex-wrap font-mono text-xs text-muted-foreground mt-0.5">
                      {item.variant_name && (
                        <span className="font-semibold text-foreground uppercase">
                          Size: {item.variant_name}
                        </span>
                      )}
                      <span>·</span>
                      <span>SKU: {item.sku}</span>
                    </div>

                    <div className="font-mono text-xs text-muted-foreground mt-1">
                      {formatMinorUnitsToPHP(item.price_minor)} each
                    </div>
                  </div>
                </div>

                {/* Quantity Controls & Line Total */}
                <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-0 border-border/50">
                  <form action={updateCartItemQuantity} className="flex items-center gap-2">
                    <input type="hidden" name="item_id" value={item.id} />
                    <label htmlFor={`qty-${item.id}`} className="sr-only">
                      Quantity for {item.product_name}
                    </label>
                    <Input
                      id={`qty-${item.id}`}
                      type="number"
                      name="quantity"
                      min="1"
                      max="99"
                      defaultValue={item.quantity}
                      className="w-16 h-10 text-center font-mono text-sm"
                    />
                    <Button
                      type="submit"
                      variant="outline"
                      size="sm"
                      className="h-10 px-3 text-xs font-semibold"
                    >
                      Update
                    </Button>
                  </form>

                  <div className="font-mono font-bold text-base text-foreground text-right min-w-[90px]">
                    {formatMinorUnitsToPHP(item.line_total_minor)}
                  </div>

                  <form action={removeCartItem}>
                    <input type="hidden" name="item_id" value={item.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 w-9 h-9"
                      title="Remove item"
                      aria-label={`Remove ${item.product_name} from bag`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </form>
                </div>
              </div>
            ))}
          </div>

          {/* Sticky Order Summary Sidebar */}
          <aside className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-24">
            <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
              <h2 className="text-xl font-bold tracking-tight text-foreground mb-4">
                Order Summary
              </h2>

              <div className="space-y-3 font-mono text-sm border-b border-border pb-5 mb-5">
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Subtotal ({cart.item_count} items)</span>
                  <span className="font-bold text-foreground">
                    {formatMinorUnitsToPHP(cart.subtotal_minor)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>{shippingMinor === 0 ? "Free delivery" : "Standard delivery"}</span>
                  <span className="font-bold text-foreground">
                    {formatMinorUnitsToPHP(shippingMinor)}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-baseline mb-6">
                <div>
                  <span className="text-base font-bold text-foreground block">Total</span>
                  <span className="text-[11px] text-muted-foreground font-mono">Includes VAT</span>
                </div>
                <span className="font-mono text-2xl font-black text-foreground">
                  {formatMinorUnitsToPHP(totalMinor)}
                </span>
              </div>

              <Button
                asChild
                size="lg"
                className="w-full h-13 bg-neutral-950 text-white hover:bg-neutral-800 font-bold text-sm uppercase tracking-wider rounded-md transition-all shadow-xs flex items-center justify-center gap-2"
              >
                <Link href="/checkout">
                  <span>Proceed to Checkout</span>
                  <ArrowRightIcon size={16} />
                </Link>
              </Button>

              <div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground font-mono">
                <ShieldCheckIcon size={15} />
                <span>Secure Checkout · Doorstep COD / GCash</span>
              </div>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
