'use client';

import Image from 'next/image';
import { X, Ruler } from 'lucide-react';

interface SizeChartDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SizeChartDialog({ isOpen, onClose }: SizeChartDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-2 text-zinc-100 font-bold text-lg tracking-wide uppercase">
            <Ruler className="size-5 text-amber-500" />
            <span>1968 Clothing — Sizing Guide</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
            aria-label="Close dialog"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <p className="text-sm text-zinc-400">
            All garments follow an oversized, relaxed streetwear boxy cut. Crafted with heavyweight 240+ GSM custom cotton. Size down for regular fit or stay true-to-size for the signature oversized drape.
          </p>

          <div className="relative w-full aspect-video bg-zinc-900 rounded-xl overflow-hidden border border-zinc-850">
            <Image
              src="/images/size-chart-1968-clothing.png"
              alt="1968 Clothing Size Chart"
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, 672px"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 uppercase tracking-wider font-semibold">
                  <th className="py-2.5 px-3">Size</th>
                  <th className="py-2.5 px-3">Chest Width (in)</th>
                  <th className="py-2.5 px-3">Body Length (in)</th>
                  <th className="py-2.5 px-3">Sleeve Length (in)</th>
                </tr>
              </thead>
              <tbody className="text-zinc-200 divide-y divide-zinc-900">
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-amber-500">S</td>
                  <td className="py-2.5 px-3">20.5&quot;</td>
                  <td className="py-2.5 px-3">28.0&quot;</td>
                  <td className="py-2.5 px-3">8.5&quot;</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-amber-500">M</td>
                  <td className="py-2.5 px-3">21.5&quot;</td>
                  <td className="py-2.5 px-3">29.0&quot;</td>
                  <td className="py-2.5 px-3">9.0&quot;</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-amber-500">L</td>
                  <td className="py-2.5 px-3">22.5&quot;</td>
                  <td className="py-2.5 px-3">30.0&quot;</td>
                  <td className="py-2.5 px-3">9.5&quot;</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-amber-500">XL</td>
                  <td className="py-2.5 px-3">23.5&quot;</td>
                  <td className="py-2.5 px-3">31.0&quot;</td>
                  <td className="py-2.5 px-3">10.0&quot;</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-amber-500">2XL</td>
                  <td className="py-2.5 px-3">24.5&quot;</td>
                  <td className="py-2.5 px-3">32.0&quot;</td>
                  <td className="py-2.5 px-3">10.5&quot;</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold uppercase tracking-wider bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg transition"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}
