"use client";

import { ArrowDown, ArrowUp, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { deleteProductImage, reorderProductImage } from "@/lib/admin/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = { imageId: string; imageLabel: string; index: number; count: number };

export function ProductMediaActions({ imageId, imageLabel, index, count }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const reorderButton = (action: "primary" | "up" | "down", label: string, icon: React.ReactNode, disabled = false) => (
    <form action={reorderProductImage}>
      <input type="hidden" name="image_id" value={imageId} />
      <input type="hidden" name="reorder_action" value={action} />
      <Button type="submit" variant="ghost" size="icon" className="size-11 md:size-9" disabled={disabled} aria-label={label}>{icon}</Button>
    </form>
  );

  return <>
    <div className="flex shrink-0 items-center">
      {reorderButton("primary", `Make ${imageLabel} the primary image`, <Star className="size-4" />, index === 0)}
      {reorderButton("up", `Move ${imageLabel} earlier`, <ArrowUp className="size-4" />, index === 0)}
      {reorderButton("down", `Move ${imageLabel} later`, <ArrowDown className="size-4" />, index === count - 1)}
      <Button type="button" variant="ghost" size="icon" className="size-11 text-destructive hover:bg-destructive/10 hover:text-destructive md:size-9" onClick={() => setConfirmDelete(true)} aria-label={`Delete ${imageLabel}`}><Trash2 className="size-4" /></Button>
    </div>
    <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Delete product image?</DialogTitle><DialogDescription>This removes “{imageLabel}” from the product gallery and storage. This action cannot be undone.</DialogDescription></DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setConfirmDelete(false)}>Keep image</Button>
          <form action={deleteProductImage}><input type="hidden" name="image_id" value={imageId} /><Button type="submit" variant="destructive">Delete image</Button></form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
