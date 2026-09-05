"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveVariant } from "@/lib/admin/actions";
import { Plus, Edit2, Loader2 } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Product = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Variant = any;

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

  // Format price from minor units to standard string (preserve valid 0 centavos)
  const defaultPrice = typeof variant?.price_minor === "number" ? (variant.price_minor / 100).toFixed(2) : "";
  const defaultCompare = typeof variant?.compare_at_price_minor === "number" ? (variant.compare_at_price_minor / 100).toFixed(2) : "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant ? (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"><Edit2 className="w-4 h-4" /></Button>
        ) : (
          <Button size="sm" variant="outline"><Plus className="w-4 h-4 mr-2" /> Add Variant</Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{variant ? "Edit Variant" : "Create Variant"}</DialogTitle>
          <DialogDescription>
            {variant ? "Update SKU, pricing, and variant details." : "Add a new size, color, or variant."}
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4 pt-4">
          {variant && <input type="hidden" name="id" value={variant.id} />}
          
          <div className="space-y-2">
            <Label htmlFor={`var_prod_${variant?.id || 'new'}`}>Product</Label>
            {variant ? (
              <div>
                <input type="hidden" name="product_id" value={variant.product_id || productId || ""} />
                <div className="text-sm font-medium p-2 bg-muted rounded border border-border">
                  {products.find((p) => p.id === (variant.product_id || productId))?.name || "Selected Product"}
                </div>
              </div>
            ) : (
              <Select name="product_id" defaultValue={productId || products[0]?.id || ""}>
                <SelectTrigger id={`var_prod_${variant?.id || 'new'}`}>
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`var_sku_${variant?.id || 'new'}`}>SKU</Label>
              <Input id={`var_sku_${variant?.id || 'new'}`} name="sku" required placeholder="e.g. TEE-BLK-M" defaultValue={variant?.sku || ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`var_name_${variant?.id || 'new'}`}>Variant Name</Label>
              <Input id={`var_name_${variant?.id || 'new'}`} name="name" placeholder="e.g. Black / M" defaultValue={variant?.name || ""} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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

          <div className="pt-4 flex justify-end">
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {variant ? "Save Changes" : "Create Variant"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
