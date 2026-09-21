"use client";

import { useState } from "react";
import { deleteAddress } from "@/lib/addresses/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function AddressDeleteButton({ addressId, label }: { addressId: string; label: string }) {
  const [open, setOpen] = useState(false);
  return <>
    <Button type="button" variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setOpen(true)}>Delete</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Delete this address?</DialogTitle><DialogDescription>“{label}” will be removed from your saved delivery addresses. Existing orders will keep their original delivery details.</DialogDescription></DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Keep address</Button>
          <form action={deleteAddress}><input type="hidden" name="address_id" value={addressId} /><Button type="submit" variant="destructive">Delete address</Button></form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
