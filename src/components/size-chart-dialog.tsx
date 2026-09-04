"use client";

import Image from "next/image";
import { Ruler } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function SizeChartDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="link" className="h-auto w-fit px-0 font-mono text-xs uppercase tracking-wider">
          <Ruler className="mr-2 size-4" aria-hidden="true" />View size guide
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>1968 Clothing size guide</DialogTitle>
          <DialogDescription>Measurements are in inches. Compare a garment you own for the most reliable fit.</DialogDescription>
        </DialogHeader>
        <Image src="/images/size-chart-1968-clothing.png" alt="1968 Clothing shirt size chart showing garment length and width measurements from Small through XXL" width={3000} height={3000} className="h-auto w-full rounded-md border border-border" />
        <p className="text-sm text-muted-foreground">Each garment is pre-washed before production to help preserve its intended silhouette and reduce shrinkage.</p>
      </DialogContent>
    </Dialog>
  );
}
