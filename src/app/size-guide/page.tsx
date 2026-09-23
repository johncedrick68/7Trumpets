import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ShoppingBag } from "lucide-react";
import {
  T_SHIRT_MEASUREMENTS,
  AUTHORITATIVE_SIZING_NOTE,
} from "@/lib/catalog/sizing";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Size Guide",
  description: "Official sizing charts and measurement guidelines for 1968 Clothing garments.",
};

export default function SizeGuidePage() {
  return (
    <main id="main-content" tabIndex={-1} className="store-container page-section min-h-screen">
      {/* ── Breadcrumb ────────────────────────────────────────── */}
      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
          <li>
            <Link href="/" className="hover:text-foreground transition-colors">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-foreground font-semibold">
            Size Guide
          </li>
        </ol>
      </nav>

      {/* ── Page Header ───────────────────────────────────────── */}
      <header className="mb-10 border-b border-border pb-6">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Fit &amp; Sizing
        </p>
        <h1 className="mt-2 text-h1 text-foreground">
          Size Guide
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          All dimensions are listed in inches. Compare these specifications against a favored garment laid flat to determine your ideal size.
        </p>
      </header>

      <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
        {/* ── How to Measure Diagram ─────────────────────────── */}
        <section aria-labelledby="measurement-instructions-heading" className="lg:col-span-5 space-y-6">
          <div className="overflow-hidden rounded-lg border border-border bg-neutral-100 dark:bg-neutral-900 p-4">
            <h2 id="measurement-instructions-heading" className="font-mono text-xs font-bold uppercase tracking-wider text-foreground mb-4">
              How to Measure
            </h2>
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded border border-border bg-muted">
              <Image
                src="/images/size-guide-diagram.svg"
                alt="Diagram illustrating shoulder-to-hem length and pit-to-pit chest width"
                fill
                sizes="(max-width: 1024px) 100vw, 40vw"
                className="object-contain p-2"
                priority
              />
            </div>
            <dl className="mt-5 space-y-3 font-sans text-sm">
              <div className="border-b border-border pb-2">
                <dt className="font-semibold text-foreground">1. Body Length</dt>
                <dd className="text-muted-foreground text-xs mt-0.5">
                  Measured straight from the highest shoulder seam down to the bottom hemline.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-foreground">2. Chest Width</dt>
                <dd className="text-muted-foreground text-xs mt-0.5">
                  Measured horizontally across the chest from armpit seam to armpit seam.
                </dd>
              </div>
            </dl>
          </div>

          {/* Authoritative Quality & Pre-wash Note */}
          <div className="rounded-lg border border-border bg-background p-5 text-xs text-muted-foreground space-y-2">
            <p className="font-semibold text-foreground">Fabric &amp; Care Standard</p>
            <p className="leading-relaxed">
              {AUTHORITATIVE_SIZING_NOTE}
            </p>
          </div>

          {/* Navigation CTA */}
          <div className="pt-2">
            <Button asChild className="w-full h-11 font-mono text-xs uppercase tracking-wider gap-2">
              <Link href="/products">
                <ShoppingBag className="size-4" />
                <span>Shop T-Shirts</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </div>
        </section>

        {/* ── Sizing Tables ───────────────────────────────────── */}
        {/* Source: public/images/size-chart-1968-clothing.png (Authoritative 1968 brand asset) */}
        <section aria-labelledby="sizing-specifications-heading" className="lg:col-span-7 space-y-8">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 id="sizing-specifications-heading" className="text-lg font-bold text-foreground">
                T-Shirt Measurements
              </h2>
              <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-border text-muted-foreground">
                Inches
              </span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <caption className="sr-only">1968 Clothing T-Shirt Measurements</caption>
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th scope="col" className="px-4 py-3 text-left font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Size
                    </th>
                    <th scope="col" className="px-4 py-3 text-center font-mono text-[11px] font-bold uppercase tracking-wider text-foreground">
                      Width
                    </th>
                    <th scope="col" className="px-4 py-3 text-center font-mono text-[11px] font-bold uppercase tracking-wider text-foreground">
                      Length
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {T_SHIRT_MEASUREMENTS.map((row) => (
                    <tr key={row.size}>
                      <th scope="row" className="px-4 py-3.5 text-left font-medium text-foreground">
                        {row.label} ({row.size})
                      </th>
                      <td className="px-4 py-3.5 text-center font-mono text-xs text-foreground">
                        {row.widthInches}&quot;
                      </td>
                      <td className="px-4 py-3.5 text-center font-mono text-xs text-foreground">
                        {row.lengthInches}&quot;
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Reference Asset Note */}
          <div className="rounded-lg border border-border bg-muted/20 p-4 flex items-center justify-between text-xs text-muted-foreground">
            <span>Verified against authoritative 1968 production specifications.</span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-foreground">S–XXL Verified</span>
          </div>

          {/* ── Secondary Family: Hoodies / Outerwear ────────────── */}
          {/* REQUIRES OWNER INPUT: Outerwear and heavyweight fleece specifications pending official brand asset.
              No unverified or speculative measurements are published to customers. */}

          <div className="pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>Questions regarding sizing or fit?</span>
            <Link href="/account/support" className="font-semibold text-foreground underline underline-offset-4 hover:opacity-80">
              Contact Support
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
