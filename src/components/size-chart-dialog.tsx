"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Ruler } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  T_SHIRT_MEASUREMENTS,
  AUTHORITATIVE_SIZING_NOTE,
} from "@/lib/catalog/sizing";

export function SizeChartDialog() {
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          variant="link"
          className="min-h-11 w-fit px-2 font-mono text-xs uppercase tracking-wider"
          aria-haspopup="dialog"
        >
          <Ruler className="mr-1.5 size-3.5" aria-hidden="true" />
          Size Guide
        </Button>
      </DialogTrigger>

      <DialogContent
        className="flex max-h-[calc(100svh-1rem)] w-[calc(100%-1rem)] max-w-[56rem] flex-col overflow-hidden p-0"
        aria-describedby="size-guide-desc"
        onCloseAutoFocus={() => triggerRef.current?.focus()}
      >
        {/* ── Header ────────────────────────────────────────── */}
        <DialogHeader className="flex-none border-b border-border px-5 py-5 pr-14 sm:px-8 sm:py-6 sm:pr-16">
          <DialogTitle className="text-lg font-bold text-foreground">
            1968 Clothing Size Guide
          </DialogTitle>
          <DialogDescription id="size-guide-desc" className="mt-1 text-sm text-muted-foreground">
            Measurements are in inches. Compare these specifications against a shirt you already own for the best fit.
          </DialogDescription>
        </DialogHeader>

        {/* ── Scrollable body ────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-7 sm:px-8 sm:py-8 space-y-8">

          {/* HOW TO MEASURE */}
          <section aria-labelledby="dialog-how-to-measure-heading">
            <h3
              id="dialog-how-to-measure-heading"
              className="mb-4 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground"
            >
              How to Measure
            </h3>

            {/* Garment illustration */}
            <div className="mb-6 overflow-hidden rounded-lg border border-border bg-muted">
              <Image
                src="/images/size-guide-diagram.svg"
                alt="Diagram showing how to measure shirt length (shoulder to hem) and width (pit to pit)"
                width={900}
                height={620}
                className="h-auto w-full object-contain"
                style={{ maxHeight: "320px" }}
              />
            </div>

            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-semibold text-foreground">Body Length</dt>
                <dd className="mt-0.5 text-sm text-muted-foreground">
                  Measure straight from the highest shoulder seam down to the bottom hemline.
                </dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-foreground">Chest Width</dt>
                <dd className="mt-0.5 text-sm text-muted-foreground">
                  Measure horizontally across the chest from armpit seam to armpit seam.
                </dd>
              </div>
            </dl>
          </section>

          {/* SIZE CHART — Semantic HTML table */}
          <section aria-labelledby="dialog-size-chart-heading">
            <div className="flex items-center justify-between mb-4">
              <h3
                id="dialog-size-chart-heading"
                className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground"
              >
                T-Shirt Measurements
              </h3>
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-0.5 rounded border border-border">
                Inches
              </span>
            </div>

            {/* Accessible table */}
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <caption className="sr-only">1968 Clothing T-Shirt Measurements in Inches</caption>
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th
                      scope="col"
                      className="px-4 py-3 text-left font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
                    >
                      Size
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-center font-mono text-[10px] font-bold uppercase tracking-widest text-foreground"
                    >
                      Width
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-center font-mono text-[10px] font-bold uppercase tracking-widest text-foreground"
                    >
                      Length
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {T_SHIRT_MEASUREMENTS.map((row) => (
                    <tr key={row.size}>
                      <th
                        scope="row"
                        className="px-4 py-3.5 text-left text-sm font-semibold text-foreground"
                      >
                        {row.label} ({row.size})
                      </th>
                      <td className="px-4 py-3.5 text-center font-mono text-sm text-foreground">
                        {row.widthInches}&Prime;
                      </td>
                      <td className="px-4 py-3.5 text-center font-mono text-sm text-foreground">
                        {row.lengthInches}&Prime;
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* SIZING / FABRIC NOTE */}
          <section
            aria-labelledby="dialog-fit-note-heading"
            className="rounded-lg border border-border/60 bg-muted/30 px-5 py-4"
          >
            <h3
              id="dialog-fit-note-heading"
              className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground"
            >
              Fabric &amp; Care Standard
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {AUTHORITATIVE_SIZING_NOTE}
            </p>
          </section>

          {/* LINK TO FULL SIZE GUIDE */}
          <div className="flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
            <span>Need full specifications or outerwear details?</span>
            <Link
              href="/size-guide"
              className="font-semibold text-foreground underline underline-offset-4 hover:opacity-80"
            >
              View full size guide &rarr;
            </Link>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
