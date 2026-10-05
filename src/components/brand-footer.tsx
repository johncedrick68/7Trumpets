'use client';

import Image from 'next/image';
import { ShieldCheck, Truck, RotateCcw, Sparkles } from 'lucide-react';

export function BrandFooter() {
  return (
    <footer className="border-t border-zinc-800 bg-zinc-950 text-zinc-400 text-xs">
      {/* Brand value pillars */}
      <div className="border-b border-zinc-850 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/60">
            <Truck className="size-5 text-amber-500 shrink-0" />
            <div>
              <p className="font-bold text-zinc-200 uppercase tracking-wider text-[11px]">
                Nationwide Delivery
              </p>
              <p className="text-[11px] text-zinc-400">Door-to-door shipping across Philippines</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/60">
            <ShieldCheck className="size-5 text-amber-500 shrink-0" />
            <div>
              <p className="font-bold text-zinc-200 uppercase tracking-wider text-[11px]">
                COD &amp; GCash Ready
              </p>
              <p className="text-[11px] text-zinc-400">Cash upon arrival or instant GCash transfer</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/60">
            <Sparkles className="size-5 text-amber-500 shrink-0" />
            <div>
              <p className="font-bold text-zinc-200 uppercase tracking-wider text-[11px]">
                Heavyweight Quality
              </p>
              <p className="text-[11px] text-zinc-400">240+ GSM custom cotton streetwear cuts</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/60">
            <RotateCcw className="size-5 text-amber-500 shrink-0" />
            <div>
              <p className="font-bold text-zinc-200 uppercase tracking-wider text-[11px]">
                Authentic Heritage
              </p>
              <p className="text-[11px] text-zinc-400">Original designs honoring Manila roots</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main footer content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="flex flex-col items-center md:items-start space-y-3 text-center md:text-left">
          <div className="relative h-10 w-32">
            <Image
              src="/images/1968%20Clothing%20Logo%20transparent.webp"
              alt="1968 Clothing"
              fill
              className="object-contain"
              sizes="128px"
            />
          </div>
          <p className="text-zinc-400 max-w-sm">
            Wear the legacy. Move the culture. Limited-run garments shaped by community, heritage, and the streets of Manila.
          </p>
        </div>

        <div className="flex flex-col items-center md:items-end space-y-2 text-zinc-400">
          <p className="font-mono text-zinc-300 font-semibold uppercase tracking-wider text-[11px]">
            Payment Methods Accepted
          </p>
          <div className="flex gap-2">
            <span className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 font-mono text-[11px] text-zinc-300">
              Cash on Delivery (COD)
            </span>
            <span className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 font-mono text-[11px] text-amber-400">
              GCash Verified
            </span>
          </div>
          <p className="text-[10px] text-zinc-500 mt-2">
            © {new Date().getFullYear()} 1968 Clothing / 7Trumpets. All Rights Reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
