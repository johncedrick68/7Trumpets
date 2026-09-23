import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Size Guide",
  description: "Official sizing charts and measurement guidelines for 1968 Clothing garments.",
};

const SHIRT_SIZES = ["S", "M", "L", "XL", "XXL"] as const;
const SHIRT_LENGTH = [28, 29, 30, 31, 32] as const;
const SHIRT_WIDTH = [20, 21, 22, 23, 24] as const;

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
          Fit & Sizing
        </p>
        <h1 className="mt-2 text-h1 text-foreground">
          Garment Size Guide
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          All dimensions are listed in inches. For the ideal silhouette, lay a favored garment flat and compare measurements against the specifications below.
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

          <div className="rounded-lg border border-border bg-background p-5 text-xs text-muted-foreground space-y-2">
            <p className="font-semibold text-foreground">Fit Note</p>
            <p>
              1968 Clothing tees feature a classic boxy, slightly relaxed streetwear cut. If you prefer an oversized aesthetic, consider sizing up one step.
            </p>
          </div>
        </section>

        {/* ── Sizing Tables ───────────────────────────────────── */}
        {/* Source: public/images/size-chart-1968-clothing.png (Authoritative 1968 brand asset) */}
        <section aria-labelledby="sizing-specifications-heading" className="lg:col-span-7 space-y-8">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 id="sizing-specifications-heading" className="text-lg font-bold text-foreground">
                T-Shirts & Tops (Inches)
              </h2>
              <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-border text-muted-foreground">
                Standard Fit
              </span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <caption className="sr-only">1968 Clothing T-Shirt Measurements in Inches</caption>
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th scope="col" className="px-4 py-3 text-left font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Size
                    </th>
                    {SHIRT_SIZES.map((size) => (
                      <th
                        key={size}
                        scope="col"
                        className="px-4 py-3 text-center font-mono text-[11px] font-bold uppercase tracking-wider text-foreground"
                      >
                        {size}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <th scope="row" className="px-4 py-3 text-left font-medium text-foreground">
                      Length (in)
                    </th>
                    {SHIRT_LENGTH.map((val, idx) => (
                      <td key={idx} className="px-4 py-3 text-center font-mono text-xs text-foreground">
                        {val}&quot;
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row" className="px-4 py-3 text-left font-medium text-foreground">
                      Width (in)
                    </th>
                    {SHIRT_WIDTH.map((val, idx) => (
                      <td key={idx} className="px-4 py-3 text-center font-mono text-xs text-foreground">
                        {val}&quot;
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Secondary Family: Hoodies / Outerwear ────────────── */}
          <div className="rounded-lg border border-dashed border-border p-6 bg-muted/20">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-foreground">
                Hoodies & Heavyweight Fleece
              </h3>
              <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground px-2 py-0.5 rounded border border-border">
                Pending Verification
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Official measurements for upcoming outerwear and fleece releases are currently being finalized.
              {/* Development note: REQUIRES OWNER INPUT for specific fleece/hoodie specs */}
            </p>
          </div>

          <div className="pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>Questions regarding sizing?</span>
            <Link href="/account/support" className="font-semibold text-foreground underline underline-offset-4 hover:opacity-80">
              Contact Support
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
