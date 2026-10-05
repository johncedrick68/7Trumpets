'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ShoppingBag, Ruler, Sparkles } from 'lucide-react';
import { useCart } from '@/lib/cart-context';
import { useState } from 'react';
import { SizeChartDialog } from '@/components/size-chart-dialog';

export function BrandHeader() {
  const { totalCount, openCart } = useCart();
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-zinc-800/80 glass-header">
        {/* Top banner notice */}
        <div className="bg-amber-500/10 border-b border-amber-500/20 py-1 text-center text-[11px] font-medium tracking-widest uppercase text-amber-400">
          <span className="flex items-center justify-center gap-1.5">
            <Sparkles className="size-3" />
            <span>Official 1968 Clothing Storefront — Nationwide COD &amp; GCash</span>
          </span>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative h-10 w-28 sm:h-12 sm:w-36 transition-transform group-hover:scale-105">
              <Image
                src="/images/1968%20Clothing%20Logo%20transparent.webp"
                alt="1968 Clothing"
                fill
                priority
                className="object-contain"
                sizes="(max-width: 640px) 112px, 144px"
              />
            </div>
          </Link>

          {/* Nav Categories */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold uppercase tracking-wider text-zinc-300">
            <a href="#drops" className="hover:text-amber-400 transition">
              Current Drops
            </a>
            <a href="#san-roque" className="hover:text-amber-400 transition">
              San Roque Collection
            </a>
            <a href="#classics" className="hover:text-amber-400 transition">
              1968 Classics
            </a>
            <button
              onClick={() => setSizeGuideOpen(true)}
              className="flex items-center gap-1.5 hover:text-amber-400 transition cursor-pointer"
            >
              <Ruler className="size-3.5" />
              <span>Size Guide</span>
            </button>
          </nav>

          {/* Right Action: Shopping Bag */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSizeGuideOpen(true)}
              className="md:hidden p-2 text-zinc-400 hover:text-white transition"
              title="Size Guide"
              aria-label="Size Guide"
            >
              <Ruler className="size-5" />
            </button>

            <button
              onClick={openCart}
              className="relative flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-100 transition cursor-pointer"
              aria-label={`Shopping Bag, ${totalCount} items`}
            >
              <ShoppingBag className="size-4 text-amber-500" />
              <span className="hidden sm:inline text-xs font-semibold uppercase tracking-wider">
                Bag
              </span>
              {totalCount > 0 && (
                <span className="flex items-center justify-center size-5 text-[10px] font-bold bg-amber-500 text-black rounded-full font-mono">
                  {totalCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <SizeChartDialog isOpen={sizeGuideOpen} onClose={() => setSizeGuideOpen(false)} />
    </>
  );
}
