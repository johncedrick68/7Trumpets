"use client";

import { useState } from "react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveVariant } from "@/lib/admin/actions";
import { Plus, Edit2, Loader2 } from "lucide-react";

interface Product {
  id: string;
  name: string;
}

interface Variant {
  id: string;
  product_id: string;
  sku: string;
  name: string | null;
  price_minor: number;
  compare_at_price_minor: number | null;
  status: string;
}

export function VariantDialog({ products, variant, productId }: { products: Product[], variant?: Variant, productId?: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    try {
      await saveVariant(formData);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  // Format price from minor units to standard string (e.g. 59900 -> "599.00")
  const defaultPrice = variant?.price_minor ? (variant.price_minor / 100).toFixed(2) : "";
  const defaultCompare = variant?.compare_at_price_minor ? (variant.compare_at_price_minor / 100).toFixed(2) : "";
  const contextualProduct = productId ? products.find((product) => product.id === productId) : undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant ? (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"><Edit2 className="w-4 h-4" /></Button>
        ) : (
          <Button size="sm" variant="outline"><Plus className="w-4 h-4 mr-2" /> Add Variant</Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{variant ? "Edit Variant" : "Add Variant"}</DialogTitle>
          <DialogDescription>
            {variant ? "Update SKU, pricing, and availability." : contextualProduct ? `Add a size, color, or option to ${contextualProduct.name}.` : "Choose a product and add its size, color, or option."}
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4 pt-2">
          {variant && <input type="hidden" name="id" value={variant.id} />}

          {productId ? (
            <input type="hidden" name="product_id" value={productId} />
          ) : (
            <div className="space-y-2">
              <Label htmlFor={`var_prod_${variant?.id || "new"}`}>Product</Label>
              <Select name="product_id" defaultValue={variant?.product_id || ""} required>
                <SelectTrigger id={`var_prod_${variant?.id || "new"}`} className="w-full">
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent position="popper">
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`var_sku_${variant?.id || 'new'}`}>SKU</Label>
              <Input id={`var_sku_${variant?.id || 'new'}`} name="sku" required placeholder="e.g. TEE-BLK-M" defaultValue={variant?.sku || ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`var_name_${variant?.id || 'new'}`}>Variant Name</Label>
              <Input id={`var_name_${variant?.id || 'new'}`} name="name" placeholder="e.g. Black / M" defaultValue={variant?.name || ""} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`var_price_${variant?.id || 'new'}`}>Price (PHP)</Label>
              <Input id={`var_price_${variant?.id || 'new'}`} type="number" step="0.01" min="0" name="price" required placeholder="599.00" defaultValue={defaultPrice} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`var_compare_${variant?.id || 'new'}`}>Compare At (Optional)</Label>
              <Input id={`var_compare_${variant?.id || 'new'}`} type="number" step="0.01" min="0" name="compare_at_price" placeholder="899.00" defaultValue={defaultCompare} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`var_status_${variant?.id || 'new'}`}>Status</Label>
            <Select name="status" defaultValue={variant?.status || "active"}>
              <SelectTrigger id={`var_status_${variant?.id || 'new'}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={loading}>Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {variant ? "Save Changes" : "Add Variant"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
