import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { formatMinorUnitsToPHP } from "@/lib/catalog/queries";
import {
  getOrCreateCart,
  removeCartItem,
  updateCartItemQuantity,
} from "@/lib/cart/actions";
import { BagIcon, ArrowRightIcon, ShieldCheckIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Trash2, AlertCircle, Minus, Plus } from "lucide-react";
import { getStoreSetting } from "@/lib/settings/queries";
import { calculateShippingMinor } from "@/lib/checkout/shipping";

export const dynamic = "force-dynamic";

export default async function CartPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [cart, fulfillmentSettings, supabase, params] = await Promise.all([
    getOrCreateCart(),
    getStoreSetting<{
      shipping_fee_minor: number;
      free_shipping_threshold_minor?: number;
    }>("fulfillment", {
      shipping_fee_minor: 15000,
      free_shipping_threshold_minor: 350000,
    }),
    createClient(),
    searchParams,
  ]);

  const { data: claimsData } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(claimsData?.claims?.sub);

  const cartItems = cart?.items ?? [];
  const itemCount = cart?.item_count ?? 0;
  const subtotalMinor = cart?.subtotal_minor ?? 0;

  const hasUnavailableItems = cartItems.some((item) => item.is_available === false);
  const purchasableItemsCount = cartItems.filter((item) => item.is_available !== false).length;

  const shippingMinor = calculateShippingMinor(
    subtotalMinor,
    "SHIPMENT",
    fulfillmentSettings,
  );
  const totalMinor = subtotalMinor + shippingMinor;

  return (
    <main id="main-content" tabIndex={-1} className="store-container cart-page min-h-screen">
      <div className="w-full">
        {/* Page Header */}
        <header className="mb-8 md:mb-10">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            Shopping Bag
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
            Your Bag {itemCount > 0 && `(${itemCount} ${itemCount === 1 ? "piece" : "pieces"})`}
          </h1>
        </header>

        {/* Global Error Notices */}
        {params.error === "cart_update_failed" && (
          <div
            role="alert"
            className="mb-6 flex items-center gap-2 rounded-md border border-red-300 bg-red-50 p-4 text-xs font-semibold text-red-900 dark:border-red-800 dark:bg-red-950/70 dark:text-red-200"
          >
            <AlertCircle className="size-4 shrink-0 text-red-700 dark:text-red-400" aria-hidden="true" />
            <span>We could not update your bag. Please verify available quantities and try again.</span>
          </div>
        )}
        {params.error === "quantity_exceeds_stock" && (
          <div
            role="alert"
            className="mb-6 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-4 text-xs font-semibold text-amber-950 dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-200"
          >
            <AlertCircle className="size-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
            <span>The requested quantity exceeds currently available inventory. Please select a lower quantity.</span>
          </div>
        )}

        {cartItems.length === 0 ? (
          /* Empty Bag State */
          <div className="mx-auto max-w-lg rounded-xl border border-dashed border-border bg-muted/10 p-8 py-20 text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <BagIcon size={32} />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Your shopping bag is empty
            </h2>
            <p className="mx-auto mt-2 mb-6 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Explore the latest 1968 Clothing archival drop pieces and find your fit.
            </p>
            <Button
              asChild
              size="lg"
              className="min-h-[44px] bg-neutral-950 px-6 font-semibold text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
            >
              <Link href="/products" className="flex items-center gap-2">
                <span>Explore Collection</span>
                <ArrowRightIcon size={16} />
              </Link>
            </Button>
          </div>
        ) : (
          /* Populated Cart Layout */
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12 lg:gap-12">
            {/* Cart Items List */}
            <div className="lg:col-span-7 xl:col-span-8">
              {/* Optional Subtle Guest Sign-in Prompt */}
              {!isAuthenticated && (
                <div className="mb-6 flex flex-col gap-2 rounded-lg border border-border/80 bg-neutral-100 p-4 sm:flex-row sm:items-center sm:justify-between dark:bg-neutral-900">
                  <p className="text-xs text-muted-foreground">
                    Already have an account?{" "}
                    <span className="font-semibold text-foreground">
                      Sign in to access your account and orders.
                    </span>
                  </p>
                  <Link
                    href="/login?next=/cart"
                    className="inline-flex min-h-[44px] items-center font-mono text-xs font-semibold text-foreground underline underline-offset-4 hover:opacity-80"
                  >
                    Sign in &rarr;
                  </Link>
                </div>
              )}

              {/* Unavailable Items Notice */}
              {hasUnavailableItems && (
                <div
                  role="alert"
                  className="mb-6 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-4 text-xs font-semibold text-amber-950 dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-200"
                >
                  <AlertCircle className="size-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
                  <span>Some items in your bag are currently unavailable and excluded from checkout.</span>
                </div>
              )}

              <ul className="divide-y divide-border border-y border-border" aria-label="Shopping bag items">
                {cartItems.map((item) => {
                  const isItemAvailable = item.is_available !== false;

                  return (
                    <li
                      key={item.id}
                      className="flex flex-col items-start justify-between gap-5 py-6 sm:flex-row sm:items-center"
                    >
                      <div className="flex w-full items-start gap-4 sm:w-auto sm:gap-5">
                        {/* Item Image Thumbnail */}
                        <Link
                          href={`/products/${item.product_slug}`}
                          className="relative block h-28 w-24 shrink-0 overflow-hidden border border-border/60 bg-neutral-100 sm:h-32 sm:w-28 dark:bg-neutral-900"
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
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <h2 className="text-base font-bold text-foreground">
                            <Link
                              href={`/products/${item.product_slug}`}
                              className="underline-offset-4 hover:underline"
                            >
                              {item.product_name}
                            </Link>
                          </h2>

                          <div className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-xs text-muted-foreground">
                            {item.variant_name && (
                              <span className="font-semibold uppercase text-foreground">
                                Size: {item.variant_name}
                              </span>
                            )}
                            <span aria-hidden="true">·</span>
                            <span>SKU: {item.sku}</span>
                          </div>

                          <div className="mt-1 font-mono text-xs text-muted-foreground">
                            {formatMinorUnitsToPHP(item.price_minor)} each
                          </div>

                          {!isItemAvailable && (
                            <span className="mt-1 inline-flex w-fit items-center rounded-sm bg-destructive/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-destructive">
                              Unavailable / Out of stock
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Quantity Controls & Line Total */}
                      <div className="flex w-full items-center justify-between gap-4 border-t border-border/50 pt-3 sm:w-auto sm:justify-end sm:border-0 sm:pt-0">
                        {/* Stepper Quantity Controls */}
                        <div className="flex items-center rounded-md border border-border bg-background">
                          <form action={updateCartItemQuantity}>
                            <input type="hidden" name="item_id" value={item.id} />
                            <input type="hidden" name="quantity" value={item.quantity - 1} />
                            <Button
                              type="submit"
                              variant="ghost"
                              size="icon"
                              disabled={item.quantity <= 1}
                              className="size-11 min-h-[44px] min-w-[44px] rounded-none rounded-l-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-20"
                              aria-label={`Decrease quantity for ${item.product_name} ${item.variant_name ? `Size ${item.variant_name}` : ""}`}
                            >
                              <Minus className="size-3.5" aria-hidden="true" />
                            </Button>
                          </form>

                          <span
                            className="w-9 text-center font-mono text-sm font-semibold text-foreground"
                            aria-label={`Current quantity: ${item.quantity}`}
                          >
                            {item.quantity}
                          </span>

                          <form action={updateCartItemQuantity}>
                            <input type="hidden" name="item_id" value={item.id} />
                            <input type="hidden" name="quantity" value={item.quantity + 1} />
                            <Button
                              type="submit"
                              variant="ghost"
                              size="icon"
                              disabled={!isItemAvailable}
                              className="size-11 min-h-[44px] min-w-[44px] rounded-none rounded-r-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-20"
                              aria-label={`Increase quantity for ${item.product_name} ${item.variant_name ? `Size ${item.variant_name}` : ""}`}
                            >
                              <Plus className="size-3.5" aria-hidden="true" />
                            </Button>
                          </form>
                        </div>

                        <div className="min-w-[85px] text-right font-mono text-base font-bold text-foreground">
                          {isItemAvailable
                            ? formatMinorUnitsToPHP(item.line_total_minor)
                            : "—"}
                        </div>

                        <form action={removeCartItem}>
                          <input type="hidden" name="item_id" value={item.id} />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="icon"
                            className="size-11 min-h-[44px] min-w-[44px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            aria-label={`Remove ${item.product_name} ${item.variant_name ? `Size ${item.variant_name}` : ""} from bag`}
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </Button>
                        </form>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* Continue Shopping Link */}
              <div className="mt-6">
                <Link
                  href="/products"
                  className="inline-flex min-h-[44px] items-center font-mono text-xs font-semibold text-foreground underline underline-offset-4 hover:opacity-80"
                >
                  &larr; Continue shopping
                </Link>
              </div>
            </div>

            {/* Order Summary Sidebar */}
            <aside className="lg:sticky lg:top-24 lg:col-span-5 xl:col-span-4" aria-label="Order summary">
              <div className="border border-border bg-card p-6">
                <h2 className="mb-4 text-xl font-bold tracking-tight text-foreground">
                  Order Summary
                </h2>

                <div className="mb-5 space-y-3 border-b border-border pb-5 font-mono text-sm">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Subtotal ({itemCount} {itemCount === 1 ? "item" : "items"})</span>
                    <span className="font-bold text-foreground">
                      {formatMinorUnitsToPHP(subtotalMinor)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>{shippingMinor === 0 ? "Free delivery" : "Standard delivery"}</span>
                    <span className="font-bold text-foreground">
                      {formatMinorUnitsToPHP(shippingMinor)}
                    </span>
                  </div>
                </div>

                <div className="mb-6 flex items-baseline justify-between">
                  <div>
                    <span className="block text-base font-bold text-foreground">Total</span>
                    <span className="font-mono text-[11px] text-muted-foreground">Includes VAT</span>
                  </div>
                  <span className="font-mono text-2xl font-black text-foreground">
                    {formatMinorUnitsToPHP(totalMinor)}
                  </span>
                </div>

                <Button
                  asChild
                  disabled={purchasableItemsCount === 0}
                  size="lg"
                  className="flex h-13 min-h-[44px] w-full items-center justify-center gap-2 rounded-md bg-neutral-950 text-sm font-bold uppercase tracking-wider text-white shadow-xs transition-all hover:bg-neutral-800 disabled:opacity-40 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
                >
                  <Link href={isAuthenticated ? "/checkout" : "/login?next=/checkout"}>
                    <span>{isAuthenticated ? "Proceed to Checkout" : "Continue to Checkout"}</span>
                    <ArrowRightIcon size={16} />
                  </Link>
                </Button>

                <div className="mt-5 flex items-center justify-center gap-2 font-mono text-xs text-muted-foreground">
                  <ShieldCheckIcon size={15} />
                  <span>Secure Checkout · Doorstep COD / GCash</span>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
