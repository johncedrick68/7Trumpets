"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveCategory } from "@/lib/admin/actions";
import { Plus, Edit2, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Category = any;

export function CategoryDialog({
  category,
  categories = [],
}: {
  category?: Category;
  categories?: Category[];
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    try {
      await saveCategory(formData);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {category ? (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"><Edit2 className="w-4 h-4" /></Button>
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
        <form action={handleSubmit} className="space-y-4 pt-4">
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

          <div className="space-y-2">
            <Label htmlFor={`cat_parent_${category?.id || 'new'}`}>Parent Category (Optional)</Label>
            <Select name="parent_id" defaultValue={category?.parent_id || "none"}>
              <SelectTrigger id={`cat_parent_${category?.id || 'new'}`}>
                <SelectValue placeholder="(No Parent)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">(No Parent)</SelectItem>
                {categories
                  .filter((c) => c.id !== category?.id)
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`cat_pos_${category?.id || 'new'}`}>Position</Label>
              <Input
                id={`cat_pos_${category?.id || 'new'}`}
                name="position"
                type="number"
                defaultValue={category?.position ?? 0}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`cat_arch_${category?.id || 'new'}`}>Status</Label>
              <Select name="archived" defaultValue={category?.archived_at ? "true" : "false"}>
                <SelectTrigger id={`cat_arch_${category?.id || 'new'}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">Active</SelectItem>
                  <SelectItem value="true">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {category ? "Save Changes" : "Create Category"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
