"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveProduct } from "@/lib/admin/actions";
import { Plus, Edit2, Loader2 } from "lucide-react";

type Category = { id: string; name: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Product = any;

export function ProductDialog({ categories, product }: { categories: Category[], product?: Product }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    try {
      await saveProduct(formData);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {product ? (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"><Edit2 className="w-4 h-4" /></Button>
        ) : (
          <Button size="sm"><Plus className="w-4 h-4 mr-2" /> Add Product</Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{product ? "Edit Product" : "Create Product"}</DialogTitle>
          <DialogDescription>
            {product ? "Update the details of your product listing." : "Add a new product to your streetwear catalog."}
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4 pt-4">
          {product && <input type="hidden" name="id" value={product.id} />}
          
          <div className="space-y-2">
            <Label htmlFor={`prod_cat_${product?.id || 'new'}`}>Category</Label>
            <Select name="category_id" defaultValue={product?.category_id || ""}>
              <SelectTrigger id={`prod_cat_${product?.id || 'new'}`}>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">(No Category)</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`prod_name_${product?.id || 'new'}`}>Product Title</Label>
            <Input id={`prod_name_${product?.id || 'new'}`} name="name" required placeholder="e.g. Kingdom Oversized Tee" defaultValue={product?.name || ""} />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`prod_slug_${product?.id || 'new'}`}>Slug</Label>
            <Input id={`prod_slug_${product?.id || 'new'}`} name="slug" required placeholder="e.g. kingdom-oversized-tee" defaultValue={product?.slug || ""} />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`prod_status_${product?.id || 'new'}`}>Status</Label>
            <Select name="status" defaultValue={product?.status || "draft"}>
              <SelectTrigger id={`prod_status_${product?.id || 'new'}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="pt-4 flex justify-end">
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {product ? "Save Changes" : "Create Product"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
