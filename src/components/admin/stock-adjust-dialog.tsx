"use client";

import * as React from "react";
import { PackagePlus, AlertCircle, ArrowRight } from "lucide-react";
import { adjustInventory } from "@/lib/admin/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/admin/status-badge";

interface StockAdjustDialogProps {
  productName: string;
  variantId: string;
  variantName: string | null;
  sku: string;
  onHand: number;
  reserved: number;
  available: number;
  trigger?: React.ReactNode;
}

export function StockAdjustDialog({
  productName,
  variantId,
  variantName,
  sku,
  onHand,
  reserved,
  available,
  trigger,
}: StockAdjustDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [delta, setDelta] = React.useState<number | "">("");
  const [movementType, setMovementType] = React.useState<"adjustment" | "restock">("adjustment");
  const [reason, setReason] = React.useState("");

  const numericDelta = typeof delta === "number" ? delta : 0;
  const resultingOnHand = onHand + numericDelta;
  const resultingAvailable = available + numericDelta;
  const isInvalid = numericDelta === 0 || !reason.trim() || resultingOnHand < 0;

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setDelta("");
      setReason("");
      setMovementType("adjustment");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-medium">
            <PackagePlus className="size-3.5" aria-hidden="true" />
            <span>Adjust Stock</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <form action={adjustInventory}>
          <input type="hidden" name="variant_id" value={variantId} />
          <input type="hidden" name="type" value={movementType} />

          <DialogHeader>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span>{productName}</span>
              <span>·</span>
              <span className="font-mono">{sku}</span>
            </div>
            <DialogTitle className="text-lg font-bold text-foreground">
              Adjust Physical Stock
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Update inventory for <strong className="font-semibold text-foreground">{variantName || "Standard Variant"}</strong>.
              All adjustments create immutable audit and ledger rows in PostgreSQL.
            </DialogDescription>
          </DialogHeader>

          {/* Current Stock Snapshot */}
          <div className="my-4 grid grid-cols-3 gap-2 rounded-lg border border-border bg-muted/30 p-3 text-center">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                On Hand
              </p>
              <p className="mt-0.5 text-base font-bold font-mono text-foreground">{onHand}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Reserved
              </p>
              <p className="mt-0.5 text-base font-bold font-mono text-muted-foreground">{reserved}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Available
              </p>
              <p className="mt-0.5 text-base font-bold font-mono text-foreground">{available}</p>
            </div>
          </div>

          <div className="space-y-4 py-1">
            {/* Movement Type */}
            <div className="space-y-1.5">
              <Label htmlFor="stock-adj-type" className="text-xs font-semibold text-foreground">
                Movement Classification
              </Label>
              <Select
                value={movementType}
                onValueChange={(val) => setMovementType(val as "adjustment" | "restock")}
              >
                <SelectTrigger id="stock-adj-type" className="h-9 text-xs">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="adjustment">
                    Adjustment (Discrepancy, Damaged write-off, Cycle count)
                  </SelectItem>
                  <SelectItem value="restock">
                    Restock (Supplier delivery, Batch production)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Delta Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="stock-adj-delta" className="text-xs font-semibold text-foreground">
                  Stock Delta (± Quantity)
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  Use positive for additions, negative for deductions
                </span>
              </div>
              <Input
                id="stock-adj-delta"
                name="delta"
                type="number"
                step="1"
                required
                value={delta}
                onChange={(e) => {
                  const val = e.target.value;
                  setDelta(val === "" ? "" : parseInt(val, 10));
                }}
                placeholder="e.g. +10 or -5"
                className="h-9 font-mono text-sm"
              />
            </div>

            {/* Resulting Stock Calculation */}
            {numericDelta !== 0 && (
              <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Resulting Available:</span>
                  <span className="font-mono font-bold text-foreground">
                    {resultingAvailable} units
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    ({available} {numericDelta > 0 ? `+ ${numericDelta}` : `- ${Math.abs(numericDelta)}`})
                  </span>
                </div>
                <StatusBadge
                  variant={resultingAvailable <= 0 ? "danger" : "success"}
                  dot={false}
                >
                  {resultingAvailable <= 0 ? "Out of Stock" : "Available"}
                </StatusBadge>
              </div>
            )}

            {resultingOnHand < 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-400">
                <AlertCircle className="size-4 shrink-0" />
                <span>Adjustment would cause on-hand stock to drop below zero.</span>
              </div>
            )}

            {/* Traceable Reason */}
            <div className="space-y-1.5">
              <Label htmlFor="stock-adj-reason" className="text-xs font-semibold text-foreground">
                Mandatory Operational Reason
              </Label>
              <Input
                id="stock-adj-reason"
                name="reason"
                type="text"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Batch #4 delivery, damaged during storage, cycle count"
                className="h-9 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="mt-5 gap-2 sm:gap-0">
            <DialogClose asChild>
              <Button type="button" variant="outline" size="sm">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              size="sm"
              disabled={isInvalid}
              className="gap-1.5 font-semibold"
            >
              <span>
                Apply Adjustment{" "}
                {numericDelta !== 0 ? (numericDelta > 0 ? `(+${numericDelta})` : `(${numericDelta})`) : ""}
              </span>
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
