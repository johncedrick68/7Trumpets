"use client";

import { useRef } from "react";
import Image from "next/image";
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

const SIZES = ["S", "M", "L", "XL", "XXL"] as const;
const LENGTH = [28, 29, 30, 31, 32] as const;
const WIDTH  = [20, 21, 22, 23, 24] as const;

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
            Measurements are in inches. For the best fit, compare these
            measurements with a shirt you already own.
          </DialogDescription>
        </DialogHeader>

        {/* ── Scrollable body ────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-7 sm:px-8 sm:py-8 space-y-8">

          {/* HOW TO MEASURE */}
          <section aria-labelledby="how-to-measure-heading">
            <h3
              id="how-to-measure-heading"
              className="mb-4 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground"
            >
              How to Measure
            </h3>

            {/* Garment illustration — illustration only, not the chart */}
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
                <dt className="text-sm font-semibold text-foreground">Length</dt>
                <dd className="mt-0.5 text-sm text-muted-foreground">
                  Measure from the highest shoulder point to the bottom hem.
                </dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-foreground">Width</dt>
                <dd className="mt-0.5 text-sm text-muted-foreground">
                  Measure across the chest from pit to pit.
                </dd>
              </div>
            </dl>
          </section>

          {/* SIZE CHART — HTML table, not image */}
          <section aria-labelledby="size-chart-heading">
            <h3
              id="size-chart-heading"
              className="mb-4 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground"
            >
              Size Chart
            </h3>

            {/* Horizontal scroll wrapper for small screens */}
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[400px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th
                      scope="col"
                      className="px-4 py-3 text-left font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
                    >
                      Size
                    </th>
                    {SIZES.map((size) => (
                      <th
                        key={size}
                        scope="col"
                        className="px-4 py-3 text-center font-mono text-[10px] font-bold uppercase tracking-widest text-foreground"
                      >
                        {size}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <th
                      scope="row"
                      className="px-4 py-3.5 text-left text-sm font-semibold text-foreground"
                    >
                      Length
                    </th>
                    {LENGTH.map((val, i) => (
                      <td
                        key={i}
                        className="px-4 py-3.5 text-center font-mono text-sm text-foreground"
                      >
                        {val}&Prime;
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th
                      scope="row"
                      className="px-4 py-3.5 text-left text-sm font-semibold text-foreground"
                    >
                      Width
                    </th>
                    {WIDTH.map((val, i) => (
                      <td
                        key={i}
                        className="px-4 py-3.5 text-center font-mono text-sm text-foreground"
                      >
                        {val}&Prime;
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* FIT NOTE */}
          <section
            aria-labelledby="fit-note-heading"
            className="rounded-lg border border-border/60 bg-muted/30 px-5 py-4"
          >
            <h3
              id="fit-note-heading"
              className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground"
            >
              Fit Note
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Each garment is pre-washed before production to help preserve its
              intended silhouette and reduce shrinkage.
            </p>
          </section>
        </div>

      </DialogContent>
    </Dialog>
  );
}
