"use client";

import * as React from "react";
import { ArrowRight, CornerDownLeft, X } from "lucide-react";
import { submitReturnRequest } from "@/lib/returns/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

interface ReturnRequestDialogProps {
  orderId: string;
  orderNumber: string;
  totalMinor: number;
}

export function ReturnRequestDialog({
  orderId,
  orderNumber,
  totalMinor,
}: ReturnRequestDialogProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [returnType, setReturnType] = React.useState<"RETURN" | "EXCHANGE" | "REFUND_ONLY">("RETURN");
  const [reason, setReason] = React.useState<"DEFECTIVE" | "WRONG_ITEM" | "WRONG_SIZE" | "CHANGE_OF_MIND" | "OTHER">("WRONG_SIZE");
  const [reasonDetails, setReasonDetails] = React.useState("");

  return (
    <div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="gap-1.5 text-xs font-mono"
      >
        <CornerDownLeft className="size-3.5" />
        Request Return or Exchange
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="w-full max-w-md border-border shadow-2xl animate-in fade-in zoom-in-95">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
              <div>
                <CardTitle className="text-base font-bold">Return / Exchange Request</CardTitle>
                <CardDescription className="font-mono text-xs">
                  Order #{orderNumber}
                </CardDescription>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </CardHeader>

            <CardContent className="p-4 pt-3">
              <form action={submitReturnRequest} className="space-y-4">
                <input type="hidden" name="order_id" value={orderId} />
                <input type="hidden" name="requested_refund_minor" value={totalMinor.toString()} />

                <div>
                  <Label htmlFor="req_type" className="text-xs font-bold">Request Type</Label>
                  <select
                    id="req_type"
                    name="type"
                    value={returnType}
                    onChange={(e) => setReturnType(e.target.value as "RETURN" | "EXCHANGE" | "REFUND_ONLY")}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs mt-1"
                  >
                    <option value="RETURN">Return for Refund</option>
                    <option value="EXCHANGE">Exchange Size / Item</option>
                    <option value="REFUND_ONLY">Refund Only (Item Damaged / Missing)</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="req_reason" className="text-xs font-bold">Reason</Label>
                  <select
                    id="req_reason"
                    name="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value as "DEFECTIVE" | "WRONG_ITEM" | "WRONG_SIZE" | "CHANGE_OF_MIND" | "OTHER")}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs mt-1"
                  >
                    <option value="WRONG_SIZE">Wrong Size (Need Different Dimensions)</option>
                    <option value="DEFECTIVE">Defective / Manufacturing Flaw</option>
                    <option value="WRONG_ITEM">Wrong Item Received</option>
                    <option value="CHANGE_OF_MIND">Change of Mind</option>
                    <option value="OTHER">Other Reason</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="req_details" className="text-xs font-bold">Additional Details</Label>
                  <textarea
                    id="req_details"
                    name="reason_details"
                    value={reasonDetails}
                    onChange={(e) => setReasonDetails(e.target.value)}
                    placeholder="Describe the issue with the garment..."
                    rows={3}
                    className="w-full rounded-md border border-input bg-background p-2.5 text-xs mt-1 resize-none"
                    required
                  />
                </div>

                <div className="p-3 bg-muted/40 rounded-lg text-xs text-muted-foreground leading-relaxed">
                  <p className="font-bold text-foreground mb-1">Return Policy Note</p>
                  Items must be unworn, unwashed with original hangtags intact. Return requests are reviewed by our operations team within 24 hours.
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsOpen(false)}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    className="text-xs font-bold gap-1.5"
                  >
                    Submit Return Request
                    <ArrowRight className="size-3.5" />
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
