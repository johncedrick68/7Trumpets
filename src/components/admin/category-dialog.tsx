"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveCategory } from "@/lib/admin/actions";
import { Plus, Edit2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Category = any;

export function CategoryDialog({ category }: { category?: Category }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {category ? (
          <Button aria-label={`Edit ${category.name} category`} variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"><Edit2 className="w-4 h-4" /></Button>
        ) : (
          <Button size="sm"><Plus className="w-4 h-4 mr-2" /> Add Category</Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{category ? "Edit Category" : "Create Category"}</DialogTitle>
          <DialogDescription>
            {category ? "Update this collection category." : "Add a new collection to group your pieces."}
          </DialogDescription>
        </DialogHeader>
        <form action={saveCategory} className="space-y-4 pt-4">
          {category && <input type="hidden" name="id" value={category.id} />}
          
          <div className="space-y-2">
            <Label htmlFor={`cat_name_${category?.id || 'new'}`}>Category Name</Label>
            <Input id={`cat_name_${category?.id || 'new'}`} name="name" required placeholder="e.g. Graphic Tees" defaultValue={category?.name || ""} />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`cat_slug_${category?.id || 'new'}`}>Slug</Label>
            <Input id={`cat_slug_${category?.id || 'new'}`} name="slug" required placeholder="e.g. graphic-tees" defaultValue={category?.slug || ""} />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`cat_desc_${category?.id || 'new'}`}>Description</Label>
            <Textarea id={`cat_desc_${category?.id || 'new'}`} name="description" placeholder="Category details..." defaultValue={category?.description || ""} />
          </div>

          {category && (
            <label className="flex min-h-11 items-center gap-3 rounded-md border p-3 text-sm">
              <input type="checkbox" name="archived" defaultChecked={Boolean(category.archived_at)} className="size-4" />
              <span><strong>{category.archived_at ? "Keep archived" : "Archive category"}</strong><span className="block text-xs text-muted-foreground">Hides this collection from customers without deleting product or order history.</span></span>
            </label>
          )}

          <div className="pt-4 flex justify-end">
            <Button type="submit">
              {category ? "Save Changes" : "Create Category"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
