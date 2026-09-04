import { redirect } from "next/navigation";

import { adjustInventory, deleteProductImage } from "@/lib/admin/actions";
import { getAdminAuthContext } from "@/lib/admin/auth";
import { formatMinorUnitsToPHP } from "@/lib/catalog/queries";
import { logServerError } from "@/lib/server-log";
import { createServiceClient } from "@/lib/supabase/server";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { CategoryDialog } from "@/components/admin/category-dialog";
import { ProductDialog } from "@/components/admin/product-dialog";
import { VariantDialog } from "@/components/admin/variant-dialog";
import { ProductImageDialog } from "@/components/admin/product-image-dialog";
import { Trash2, Image as ImageIcon, PackagePlus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminCatalogOverviewPage(props: {
  searchParams?: Promise<{ notice?: string; error?: string }>;
}) {
  const adminCtx = await getAdminAuthContext();
  if (!adminCtx) {
    redirect("/login?next=/admin/catalog");
  }

  const searchParams = await props.searchParams;
  const notice = searchParams?.notice;
  const error = searchParams?.error;

  const serviceClient = createServiceClient();

  // Fetch categories
  const { data: categories } = await serviceClient
    .from("categories")
    .select("id, name, slug, position, archived_at")
    .order("position", { ascending: true });

  // Fetch products with variants and inventory status
  const { data: products, error: productsError } = await serviceClient
    .from("products")
    .select(`
      id,
      category_id,
      name,
      slug,
      status,
      description,
      created_at,
      product_variants (
        id,
        sku,
        name,
        price_minor,
        compare_at_price_minor,
        status,
        inventory (
          on_hand,
          reserved,
          safety_stock
        ),
        variant_option_values (option_id, option_value_id)
      ),
      product_options (
        id, name, position,
        product_option_values (id, value, position)
      ),
      product_images (id, storage_path, alt_text, position, variant_id)
    `)
    .order("created_at", { ascending: false });

  if (productsError) {
    logServerError("admin.catalog", "database_failure");
    throw new Error("ADMIN_CATALOG_UNAVAILABLE");
  }
  const productList = products || [];
  const categoryList = categories || [];

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-2">Catalog & Inventory</h1>
          <p className="text-muted-foreground text-sm max-w-2xl">
            Operational management of categories, archival pieces, sizing, and stock levels.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <CategoryDialog />
          <ProductDialog categories={categoryList} />
          <VariantDialog products={productList} />
          <ProductImageDialog products={productList} />
        </div>
      </header>

      {notice && (
        <div className="p-4 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900/50 dark:text-emerald-400">
          Action completed: {notice}
        </div>
      )}
      {error && (
        <div className="p-4 rounded-md bg-destructive/10 text-destructive border border-destructive/20">
          Error: {error}
        </div>
      )}

      {/* Categories Table (Optional bonus to show they exist) */}
      <Card>
        <CardHeader>
          <CardTitle>Categories</CardTitle>
          <CardDescription>Manage your product collections.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {categoryList.map(cat => (
              <div key={cat.id} className="flex items-center gap-2 bg-muted/50 border border-border px-3 py-1 rounded-full text-sm">
                <span className="font-medium">{cat.name}</span>
                <CategoryDialog category={cat} />
              </div>
            ))}
            {categoryList.length === 0 && <span className="text-sm text-muted-foreground">No categories defined.</span>}
          </div>
        </CardContent>
      </Card>

      {/* Existing Products & Variants Table */}
      <Card>
        <CardHeader>
          <CardTitle>Active Catalog & Inventory ({productList.length})</CardTitle>
          <CardDescription>Manage products, variants, images, and perform fast stock adjustments.</CardDescription>
        </CardHeader>
        
        {productList.length === 0 ? (
          <CardContent className="text-center py-12 text-muted-foreground border-t border-dashed">
            No products found in the catalog. Click &quot;Add Product&quot; to create one.
          </CardContent>
        ) : (
          <div className="border-t">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[30%]">Product</TableHead>
                  <TableHead className="w-[10%]">Status</TableHead>
                  <TableHead>Variants, Pricing & Stock Adjustments</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productList.map((product) => (
                  <TableRow key={product.id} className="group items-start align-top">
                    <TableCell className="pt-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold text-base">{product.name}</div>
                          <div className="font-mono text-[10px] text-muted-foreground mt-1">slug: {product.slug}</div>
                        </div>
                        <ProductDialog categories={categoryList} product={product} />
                      </div>
                      
                      <div className="mt-4 space-y-2">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {product.product_images.sort((a: any, b: any) => a.position - b.position).map((image: any) => (
                          <div key={image.id} className="flex items-center justify-between gap-2 p-1.5 bg-muted/30 rounded border border-border/50">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <ImageIcon className="w-3 h-3 text-muted-foreground shrink-0" />
                              <span className="text-[10px] truncate text-muted-foreground">Pos {image.position}: {image.alt_text}</span>
                            </div>
                            <form action={deleteProductImage}>
                              <input type="hidden" name="image_id" value={image.id} />
                              <Button type="submit" variant="ghost" size="icon" className="h-5 w-5 text-destructive hover:text-destructive hover:bg-destructive/10">
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </form>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="pt-4">
                      <Badge variant={product.status === "published" ? "default" : product.status === "archived" ? "secondary" : "outline"} className="capitalize">
                        {product.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="pt-4 pb-6">
                      {product.product_variants.length === 0 ? (
                        <div className="text-sm text-muted-foreground italic mb-2">No variants created yet.</div>
                      ) : (
                        <div className="flex flex-col gap-3">
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          {product.product_variants.map((variant: any) => {
                            const inv = variant.inventory?.[0];
                            const available = inv ? inv.on_hand - inv.reserved : 0;
                            const isLowStock = available <= (inv?.safety_stock ?? 0);
                            const isOutOfStock = available <= 0;

                            return (
                              <div key={variant.id} className="border border-border p-3 rounded-md bg-muted/10 shadow-sm relative overflow-hidden">
                                <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
                                  <div className="flex items-center gap-2">
                                    <strong className="text-sm">{variant.name || variant.sku}</strong>
                                    <span className="font-mono text-[10px] text-muted-foreground px-1.5 py-0.5 bg-background rounded border">{variant.sku}</span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <strong className="font-mono text-sm">{formatMinorUnitsToPHP(variant.price_minor)}</strong>
                                    <VariantDialog products={productList} variant={variant} productId={product.id} />
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-2 font-mono text-[11px] mb-3">
                                  <Badge variant={isOutOfStock ? "destructive" : isLowStock ? "secondary" : "outline"} className="text-[9px] rounded-sm py-0 h-4">
                                    {isOutOfStock ? "OUT OF STOCK" : isLowStock ? "LOW STOCK" : "IN STOCK"}
                                  </Badge>
                                  <span className="text-muted-foreground">
                                    <strong>{available}</strong> available ({inv?.on_hand ?? 0} on hand, {inv?.reserved ?? 0} reserved)
                                  </span>
                                </div>
                                
                                {/* Fast Stock Adjustment Form */}
                                <form action={adjustInventory} className="flex gap-2 items-center flex-wrap bg-background p-2 rounded border border-border/50">
                                  <input type="hidden" name="variant_id" value={variant.id} />
                                  <input type="hidden" name="type" value="adjustment" />
                                  
                                  <div className="relative w-20">
                                    <PackagePlus className="w-3 h-3 absolute left-2 top-2.5 text-muted-foreground" />
                                    <Input type="number" name="delta" required placeholder="± qty" className="h-8 pl-6 pr-2 text-xs font-mono" />
                                  </div>
                                  <Input type="text" name="reason" required placeholder="Reason for change" className="h-8 flex-1 min-w-[140px] text-xs" />
                                  <Button type="submit" variant="secondary" size="sm" className="h-8 text-xs px-3">
                                    Adjust
                                  </Button>
                                </form>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
