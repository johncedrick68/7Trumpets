"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveProductImage } from "@/lib/admin/actions";
import { Loader2, ImagePlus } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Product = any;

export function ProductImageDialog({ products, productId }: { products: Product[], productId?: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    try {
      await saveProductImage(formData);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><ImagePlus className="w-4 h-4 mr-2" /> Add Image</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Upload Product Image</DialogTitle>
          <DialogDescription>
            Upload a high-quality WebP, JPG, or PNG image for your product.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4 pt-4">
          
          <div className="space-y-2">
            <Label htmlFor="img_prod">Product</Label>
            <Select name="product_id" defaultValue={productId || ""}>
              <SelectTrigger id="img_prod">
                <SelectValue placeholder="Select a product" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="img_variant">Variant (Optional)</Label>
            <Select name="variant_id" defaultValue="">
              <SelectTrigger id="img_variant">
                <SelectValue placeholder="All variants (Default)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">All variants (Default)</SelectItem>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {products.flatMap((product) => product.product_variants.map((variant: any) => (
                  <SelectItem key={variant.id} value={variant.id}>{product.name}: {variant.name || variant.sku}</SelectItem>
                )))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="img_file">Image File (WebP/JPG/PNG)</Label>
            <Input id="img_file" name="image" type="file" accept="image/webp,image/jpeg,image/png" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="img_alt">Alt Text</Label>
              <Input id="img_alt" name="alt_text" required placeholder="Description of image" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="img_pos">Position (Order)</Label>
              <Input id="img_pos" name="position" type="number" required defaultValue="0" />
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Upload Image
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
