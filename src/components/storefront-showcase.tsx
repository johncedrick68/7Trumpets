'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ArrowDown, Flame, Sparkles, Layers, ShieldCheck, Ruler } from 'lucide-react';
import { Product, Category } from '@/types';
import { ProductCard } from '@/components/product-card';
import { ProductModal } from '@/components/product-modal';
import { SizeChartDialog } from '@/components/size-chart-dialog';

interface StorefrontShowcaseProps {
  initialProducts: Product[];
  categories: Category[];
}

export function StorefrontShowcase({ initialProducts, categories }: StorefrontShowcaseProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);

  const filteredProducts =
    selectedCategory === 'all'
      ? initialProducts
      : initialProducts.filter((p) => p.category?.slug === selectedCategory);

  return (
    <div className="space-y-16 pb-20">
      {/* ── Editorial Streetwear Hero ─────────────────────────────────── */}
      <section className="relative border-b border-zinc-800/80 bg-gradient-to-b from-zinc-900/60 via-zinc-950 to-zinc-950 pt-16 pb-20 sm:pt-24 sm:pb-28 overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-amber-500/5 blur-[120px] pointer-events-none rounded-full" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-900/90 border border-zinc-800 text-[11px] font-mono uppercase tracking-widest text-amber-400">
            <Flame className="size-3.5" />
            <span>Drop 01 Archive • Limited Run</span>
          </div>

          <div className="mx-auto max-w-md px-4">
            <Image
              src="/images/1968%20Clothing%20Banner%20transparent.png"
              alt="1968 Clothing"
              width={500}
              height={140}
              priority
              className="w-full h-auto object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]"
            />
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white uppercase max-w-3xl mx-auto leading-none">
            Wear the legacy. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">
              Move the culture.
            </span>
          </h1>

          <p className="text-sm sm:text-base text-zinc-400 max-w-xl mx-auto leading-relaxed">
            Limited-run garments shaped by community, heritage, and the streets of Manila.
            Heavyweight 240+ GSM custom cotton with archival screenprint artwork.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <a
              href="#catalog"
              className="w-full sm:w-auto px-8 py-3.5 bg-amber-500 hover:bg-amber-400 text-black font-bold uppercase tracking-wider text-xs rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-amber-500/20"
            >
              <span>Explore Collection</span>
              <ArrowDown className="size-4" />
            </a>

            <button
              onClick={() => setSizeGuideOpen(true)}
              className="w-full sm:w-auto px-6 py-3.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 font-semibold uppercase tracking-wider text-xs rounded-xl flex items-center justify-center gap-2 transition"
            >
              <Ruler className="size-4 text-amber-500" />
              <span>Sizing Guide</span>
            </button>
          </div>
        </div>
      </section>

      {/* ── Product Catalog Section ───────────────────────────────────── */}
      <section id="catalog" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 scroll-mt-24">
        {/* Category Filter Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-850 pb-5">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold uppercase tracking-wide text-zinc-100 flex items-center gap-2">
              <Layers className="size-5 text-amber-500" />
              <span>Streetwear Drops</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Showing {filteredProducts.length} archival garments
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition whitespace-nowrap ${
                selectedCategory === 'all'
                  ? 'bg-amber-500 text-black shadow'
                  : 'bg-zinc-900/80 text-zinc-400 hover:text-white border border-zinc-800'
              }`}
            >
              All Drops
            </button>

            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.slug)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition whitespace-nowrap ${
                  selectedCategory === cat.slug
                    ? 'bg-amber-500 text-black shadow'
                    : 'bg-zinc-900/80 text-zinc-400 hover:text-white border border-zinc-800'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onSelect={(p) => setActiveProduct(p)}
            />
          ))}
        </div>
      </section>

      {/* ── Brand Manifesto Banner ────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-3xl bg-zinc-900/80 border border-zinc-800 overflow-hidden p-8 sm:p-12 lg:p-16 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-4 max-w-xl text-center md:text-left">
            <span className="text-xs font-mono text-amber-500 uppercase tracking-widest font-semibold flex items-center justify-center md:justify-start gap-1.5">
              <Sparkles className="size-4" />
              <span>The 1968 Standard</span>
            </span>
            <h3 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight uppercase">
              Engineered for the streets. built to last.
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              Every drop is constructed with reinforced double-needle stitching, pre-shrunk heavyweight cotton, and high-density screenprint ink that resists peeling and fading even through intensive wear.
            </p>
            <div className="pt-2 flex flex-wrap gap-4 text-xs font-mono text-zinc-300">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-emerald-400" /> 100% Authentic
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-emerald-400" /> Preshrunk Heavy Cotton
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-emerald-400" /> Archival Screenprint
              </span>
            </div>
          </div>

          <div className="relative size-48 sm:size-64 shrink-0 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl">
            <Image
              src="/images/1968%20Clothing%20Page%20Profile.webp"
              alt="1968 Brand Badge"
              fill
              className="object-cover"
              sizes="(max-width: 640px) 192px, 256px"
            />
          </div>
        </div>
      </section>

      {/* Modals */}
      <ProductModal product={activeProduct} onClose={() => setActiveProduct(null)} />
      <SizeChartDialog isOpen={sizeGuideOpen} onClose={() => setSizeGuideOpen(false)} />
    </div>
  );
}
