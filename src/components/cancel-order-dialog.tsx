"use client";

import * as React from "react";
import { AlertTriangle, XCircle, X } from "lucide-react";
import { cancelOrderAction } from "@/lib/orders/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

interface CancelOrderDialogProps {
  orderId: string;
  orderNumber: string;
}

export function CancelOrderDialog({
  orderId,
  orderNumber,
}: CancelOrderDialogProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [reason, setReason] = React.useState("Changed mind before dispatch");

  return (
    <div>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="w-full gap-1.5 text-xs font-mono"
      >
        <XCircle className="size-3.5" />
        Cancel Order
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="w-full max-w-md border-border shadow-2xl animate-in fade-in zoom-in-95">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
              <div>
                <CardTitle className="text-base font-bold text-destructive flex items-center gap-2">
                  <AlertTriangle className="size-4" />
                  Cancel Order
                </CardTitle>
                <CardDescription className="font-mono text-xs">
                  Order #{orderNumber}
                </CardDescription>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="Close cancellation dialog"
              >
                <X className="size-4" />
              </button>
            </CardHeader>

            <CardContent className="p-4 pt-4">
              <form action={cancelOrderAction} className="space-y-4">
                <input type="hidden" name="order_id" value={orderId} />

                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive leading-relaxed">
                  Are you sure you want to cancel this order? Any reserved pieces will be released back to public inventory immediately.
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cancel-reason" className="text-xs font-mono">
                    Reason for Cancellation
                  </Label>
                  <select
                    id="cancel-reason"
                    name="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full text-xs bg-muted/40 border border-border rounded-md p-2.5 font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="Changed mind before dispatch">Changed mind before dispatch</option>
                    <option value="Need to change sizing / color">Need to change sizing / color</option>
                    <option value="Ordered by mistake">Ordered by mistake</option>
                    <option value="Need to update delivery address">Need to update delivery address</option>
                  </select>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsOpen(false)}
                    className="flex-1 text-xs"
                  >
                    Keep Order
                  </Button>
                  <Button
                    type="submit"
                    variant="destructive"
                    className="flex-1 text-xs font-bold"
                  >
                    Confirm Cancellation
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
