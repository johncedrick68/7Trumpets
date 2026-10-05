'use client';

import Image from 'next/image';
import { X, Plus, Minus, Trash2, ShoppingBag, ShieldCheck, ArrowRight } from 'lucide-react';
import { useCart } from '@/lib/cart-context';
import { formatPHP } from '@/lib/money';

export function CartDrawer() {
  const { items, isOpen, closeCart, updateQuantity, removeItem, totalCount, totalMinor, clearCart } =
    useCart();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={closeCart}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-zinc-950 border-l border-zinc-800 text-zinc-100 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
          {/* Header */}
          <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="size-5 text-amber-500" />
              <h2 className="font-bold uppercase tracking-wider text-sm">
                Shopping Bag ({totalCount})
              </h2>
            </div>
            <button
              onClick={closeCart}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
              aria-label="Close cart"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                <div className="p-4 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500">
                  <ShoppingBag className="size-8" />
                </div>
                <h3 className="font-semibold text-zinc-200">Your bag is empty</h3>
                <p className="text-xs text-zinc-500 max-w-xs">
                  Discover our streetwear drops and add your favorite cuts to the bag.
                </p>
                <button
                  onClick={closeCart}
                  className="mt-2 px-5 py-2 text-xs font-semibold uppercase tracking-wider bg-amber-500 hover:bg-amber-400 text-black rounded-lg transition"
                >
                  Explore Drops
                </button>
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.variantId}
                  className="flex gap-4 p-3 bg-zinc-900/60 border border-zinc-800/80 rounded-xl"
                >
                  <div className="relative size-20 rounded-lg overflow-hidden bg-zinc-900 shrink-0 border border-zinc-800">
                    <Image
                      src={item.image}
                      alt={item.productName}
                      fill
                      className="object-cover"
                      sizes="80px"
                    />
                  </div>

                  <div className="flex-1 flex flex-col justify-between min-w-0">
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="font-semibold text-sm text-zinc-100 truncate">
                          {item.productName}
                        </h4>
                        <button
                          onClick={() => removeItem(item.variantId)}
                          className="text-zinc-500 hover:text-red-400 transition p-0.5"
                          title="Remove item"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                      <span className="inline-block text-[11px] font-mono text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded mt-1">
                        {item.variantName}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center border border-zinc-700 rounded-lg bg-zinc-950">
                        <button
                          onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                          className="p-1 hover:text-white text-zinc-400 transition"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="size-3" />
                        </button>
                        <span className="px-2 text-xs font-mono font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                          className="p-1 hover:text-white text-zinc-400 transition"
                          aria-label="Increase quantity"
                        >
                          <Plus className="size-3" />
                        </button>
                      </div>

                      <span className="font-semibold text-sm text-zinc-100 font-mono">
                        {formatPHP(item.priceMinor * item.quantity)}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer & Checkout */}
          {items.length > 0 && (
            <div className="p-5 border-t border-zinc-800 bg-zinc-950 space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">Subtotal</span>
                <span className="font-bold text-lg text-zinc-100 font-mono">
                  {formatPHP(totalMinor)}
                </span>
              </div>

              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800 text-[11px] text-zinc-400">
                <ShieldCheck className="size-4 text-emerald-400 shrink-0" />
                <span>Cash on Delivery &amp; Manual GCash available at checkout.</span>
              </div>

              <button
                onClick={() => {
                  alert(
                    `Checkout initiated for ${totalCount} items (${formatPHP(totalMinor)}).\nPayment: COD or GCash available.`
                  );
                }}
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-black font-bold uppercase tracking-wider text-xs rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-amber-500/10 cursor-pointer"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight className="size-4" />
              </button>

              <button
                onClick={clearCart}
                className="w-full text-center text-xs text-zinc-500 hover:text-zinc-400 py-1 transition"
              >
                Clear Bag
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
