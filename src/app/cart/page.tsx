import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { formatMinorUnitsToPHP } from "@/lib/catalog/queries";
import {
  getOrCreateCart,
  removeCartItem,
  updateCartItemQuantity,
} from "@/lib/cart/actions";
import { Button } from "@/components/ui/button";
import { AlertCircle, Check, Minus, Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shopping Cart | 1968 Clothing",
  description: "Review your selected 1968 pieces before proceeding to checkout.",
};

export default async function CartPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [cart, supabase, params] = await Promise.all([
    getOrCreateCart(),
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

  return (
    <main id="main-content" tabIndex={-1} className="store-container cart-page min-h-screen py-8 md:py-12">
      <div className="w-full">
        {/* Page Header */}
        <header className="mb-8 md:mb-10">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            Shopping Bag
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
            Your Cart{itemCount > 0 ? ` (${itemCount} ${itemCount === 1 ? "piece" : "pieces"})` : ""}
          </h1>
        </header>

        {/* Global Error Notices */}
        {params.error === "cart_update_failed" && (
          <div
            role="alert"
            className="mb-6 flex items-center gap-2 rounded-none border border-neutral-300 bg-neutral-50 p-4 text-xs font-mono uppercase tracking-wider text-foreground dark:border-neutral-800 dark:bg-neutral-900"
          >
            <AlertCircle className="size-4 shrink-0 text-foreground" aria-hidden="true" />
            <span>We could not update your cart. Please verify available quantities and try again.</span>
          </div>
        )}
        {params.error === "quantity_exceeds_stock" && (
          <div
            role="alert"
            className="mb-6 flex items-center gap-2 rounded-none border border-neutral-300 bg-neutral-50 p-4 text-xs font-mono uppercase tracking-wider text-foreground dark:border-neutral-800 dark:bg-neutral-900"
          >
            <AlertCircle className="size-4 shrink-0 text-foreground" aria-hidden="true" />
            <span>The requested quantity exceeds currently available inventory. Please select a lower quantity.</span>
          </div>
        )}
        {(params.error === "variant_unavailable" || params.error === "invalid_quantity" || params.error === "quantity_exceeds_limit") && (
          <div
            role="alert"
            className="mb-6 flex items-center gap-2 rounded-none border border-neutral-300 bg-neutral-50 p-4 text-xs font-mono uppercase tracking-wider text-foreground dark:border-neutral-800 dark:bg-neutral-900"
          >
            <AlertCircle className="size-4 shrink-0 text-foreground" aria-hidden="true" />
            <span>Unable to process cart request. Please choose an available product option.</span>
          </div>
        )}

        {cartItems.length === 0 ? (
          /* Empty Bag State */
          <div className="py-16 md:py-24 text-left border-t border-border">
            <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Your cart is empty.
            </h2>
            <div className="mt-6">
              <Button
                asChild
                className="h-12 min-h-[48px] px-8 rounded-none bg-black text-white hover:bg-neutral-800 font-mono text-xs uppercase tracking-wider font-bold dark:bg-white dark:text-black dark:hover:bg-neutral-200 cursor-pointer"
              >
                <Link href="/products">
                  Continue Shopping
                </Link>
              </Button>
            </div>
            {!isAuthenticated && (
              <div className="mt-8 pt-6 border-t border-border/60">
                <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
                  Have an account?{" "}
                  <Link
                    href="/login?next=/cart"
                    className="font-bold text-foreground underline underline-offset-4 hover:opacity-80"
                  >
                    Log in to check out faster.
                  </Link>
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Populated Cart Layout */
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12 lg:gap-12">
            {/* Cart Items List Column */}
            <div className="lg:col-span-7 xl:col-span-8">
              {/* Optional Subtle Guest Sign-in Prompt */}
              {!isAuthenticated && (
                <div className="mb-6 border border-border bg-neutral-50 p-4 dark:bg-neutral-900/60 rounded-none">
                  <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
                    Have an account?{" "}
                    <Link
                      href="/login?next=/checkout"
                      className="font-bold text-foreground underline underline-offset-4 hover:opacity-80"
                    >
                      Sign in to check out faster.
                    </Link>
                  </p>
                </div>
              )}

              {/* Unavailable Items Notice */}
              {hasUnavailableItems && (
                <div
                  role="alert"
                  className="mb-6 flex items-center gap-2 border border-neutral-300 bg-neutral-50 p-4 text-xs font-mono uppercase tracking-wider text-foreground dark:border-neutral-800 dark:bg-neutral-900 rounded-none"
                >
                  <AlertCircle className="size-4 shrink-0 text-foreground" aria-hidden="true" />
                  <span>Some items in your cart are currently out of stock and excluded from checkout.</span>
                </div>
              )}

              <ul className="divide-y divide-border border-y border-border" aria-label="Shopping bag items">
                {cartItems.map((item) => {
                  const isItemAvailable = item.is_available !== false;
                  const itemTitle = `${item.product_name}${item.variant_name ? ` Size ${item.variant_name}` : ""}`;

                  return (
                    <li
                      key={item.id}
                      className="flex flex-col items-start justify-between gap-6 py-6 sm:flex-row sm:items-center"
                    >
                      <div className="flex w-full items-start gap-4 sm:w-auto sm:gap-6">
                        {/* Item Image Thumbnail */}
                        <Link
                          href={`/products/${item.product_slug}`}
                          className="relative block h-28 w-20 shrink-0 overflow-hidden border border-border bg-neutral-100 sm:h-36 sm:w-28 md:h-40 md:w-32 rounded-none aspect-[4/5] dark:bg-neutral-900"
                          aria-label={item.product_name}
                        >
                          <Image
                            src={item.image_path || "/images/1968%20CLOTHING%20V1.webp"}
                            alt={item.product_name}
                            fill
                            sizes="(max-width: 640px) 96px, 128px"
                            className="object-cover object-center"
                          />
                        </Link>

                        {/* Item Details */}
                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                          <h2 className="text-base font-bold text-foreground">
                            <Link
                              href={`/products/${item.product_slug}`}
                              className="underline-offset-4 hover:underline"
                            >
                              {item.product_name}
                            </Link>
                          </h2>

                          {item.variant_name && (
                            <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                              <span>Size: </span>
                              <span className="font-bold text-foreground">{item.variant_name}</span>
                            </div>
                          )}

                          <div className="font-mono text-xs text-muted-foreground">
                            {formatMinorUnitsToPHP(item.price_minor)} each
                          </div>

                          {!isItemAvailable && (
                            <div className="mt-1">
                              <span className="inline-flex items-center border border-border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground line-through bg-neutral-100 dark:bg-neutral-900 rounded-none">
                                Unavailable / Out of stock
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Quantity Controls, Line Total & Remove Action */}
                      <div className="flex w-full flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-4 sm:w-auto sm:flex-nowrap sm:justify-end sm:gap-4 sm:border-0 sm:pt-0">
                        <div className="flex items-center gap-3">
                          {/* Stepper Quantity Controls */}
                          <div className="flex items-center rounded-none border border-border bg-background">
                            <form action={updateCartItemQuantity}>
                              <input type="hidden" name="item_id" value={item.id} />
                              <input type="hidden" name="quantity" value={item.quantity - 1} />
                              <Button
                                type="submit"
                                variant="ghost"
                                size="icon"
                                disabled={item.quantity <= 1}
                                className="size-11 min-h-[44px] min-w-[44px] rounded-none text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 cursor-pointer"
                                aria-label={`Decrease quantity for ${itemTitle}`}
                              >
                                <Minus className="size-3.5" aria-hidden="true" />
                              </Button>
                            </form>

                            <span
                              className="w-9 text-center font-mono text-sm font-semibold text-foreground select-none"
                              aria-label={`Current quantity for ${itemTitle}: ${item.quantity}`}
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
                                className="size-11 min-h-[44px] min-w-[44px] rounded-none text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 cursor-pointer"
                                aria-label={`Increase quantity for ${itemTitle}`}
                              >
                                <Plus className="size-3.5" aria-hidden="true" />
                              </Button>
                            </form>
                          </div>

                          {/* Quiet Ghost Remove Button */}
                          <form action={removeCartItem}>
                            <input type="hidden" name="item_id" value={item.id} />
                            <Button
                              type="submit"
                              variant="ghost"
                              className="h-11 min-h-[44px] px-2 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-transparent underline underline-offset-4 cursor-pointer rounded-none"
                              aria-label={`Remove ${itemTitle} from bag`}
                            >
                              Remove
                            </Button>
                          </form>
                        </div>

                        {/* Line Total */}
                        <div className="text-right font-mono text-sm font-bold text-foreground">
                          {isItemAvailable
                            ? formatMinorUnitsToPHP(item.line_total_minor)
                            : "—"}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* Continue Shopping Link */}
              <div className="mt-8">
                <Link
                  href="/products"
                  className="inline-flex min-h-[44px] items-center font-mono text-xs uppercase tracking-wider font-semibold text-foreground underline underline-offset-4 hover:opacity-80"
                >
                  &larr; Continue shopping
                </Link>
              </div>
            </div>

            {/* Order Summary Sidebar */}
            <aside className="lg:sticky lg:top-24 lg:col-span-5 xl:col-span-4" aria-label="Order summary">
              <div className="border border-border bg-card p-6 rounded-none space-y-6">
                <h2 className="font-mono text-xs uppercase tracking-wider font-bold text-foreground">
                  Summary
                </h2>

                <div className="space-y-3 border-y border-border py-4 font-mono text-sm">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Subtotal ({itemCount} {itemCount === 1 ? "item" : "items"})</span>
                    <span className="font-bold text-foreground">
                      {formatMinorUnitsToPHP(subtotalMinor)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border/60">
                    <span>Shipping</span>
                    <span>Calculated at checkout</span>
                  </div>
                </div>

                <div className="flex items-baseline justify-between pt-1">
                  <div>
                    <span className="block font-mono text-xs uppercase tracking-wider font-bold text-foreground">
                      Estimated Total
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      Taxes included
                    </span>
                  </div>
                  <span className="font-mono text-2xl font-bold text-foreground">
                    {formatMinorUnitsToPHP(subtotalMinor)}
                  </span>
                </div>

                {purchasableItemsCount === 0 ? (
                  <Button
                    disabled
                    className="w-full h-12 min-h-[48px] rounded-none bg-black text-white disabled:opacity-40 font-mono text-xs uppercase tracking-wider font-bold dark:bg-white dark:text-black cursor-not-allowed"
                  >
                    Checkout
                  </Button>
                ) : (
                  <Button
                    asChild
                    className="w-full h-12 min-h-[48px] rounded-none bg-black text-white hover:bg-neutral-800 font-mono text-xs uppercase tracking-wider font-bold transition-colors dark:bg-white dark:text-black dark:hover:bg-neutral-200 cursor-pointer"
                  >
                    <Link href={isAuthenticated ? "/checkout" : "/login?next=/checkout"}>
                      Checkout
                    </Link>
                  </Button>
                )}

                {/* Verified Assurances */}
                <div className="space-y-2 pt-4 border-t border-border/60 font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <Check className="size-3.5 text-foreground shrink-0" aria-hidden="true" />
                    <span>Cash on Delivery & Manual GCash</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="size-3.5 text-foreground shrink-0" aria-hidden="true" />
                    <span>Inventory confirmed before order placement</span>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
