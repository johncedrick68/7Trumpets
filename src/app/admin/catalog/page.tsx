import { redirect } from "next/navigation";
import Image from "next/image";

import { adjustInventory } from "@/lib/admin/actions";
import { getAdminAuthContext } from "@/lib/admin/auth";
import { formatMinorUnitsToPHP, productImageUrl } from "@/lib/catalog/queries";
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
import { PackagePlus } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ProductMediaActions } from "@/components/admin/product-media-actions";
import { ProductOptionsPanel } from "@/components/admin/product-options-panel";

export const dynamic = "force-dynamic";

const catalogNotices: Record<string, string> = {
  product_image_saved: "Product image uploaded.",
  product_image_deleted: "Product image deleted.",
  product_image_reordered: "Product image order updated.",
  inventory_adjusted: "Inventory updated.",
  category_saved: "Category saved.",
  product_saved: "Product saved.",
  variant_saved: "Variant saved.",
  option_saved: "Product option saved.",
  option_value_saved: "Option value saved.",
  variant_option_saved: "Variant option saved.",
};

const catalogErrors: Record<string, string> = {
  invalid_product_image: "Choose a product, add descriptive alt text, and upload an image under 5 MB.",
  product_image_type_mismatch: "The file contents do not match its image type. Use a valid WebP, JPG, or PNG file.",
  product_image_upload_failed: "The image could not be uploaded. Please try again.",
  save_product_image_failed: "The image uploaded but could not be attached to the product.",
  product_image_not_found: "That image no longer exists.",
  delete_product_image_failed: "The image could not be deleted. Please try again.",
  invalid_image_order: "That image-order change was not valid.",
  reorder_product_image_failed: "The image order could not be updated. Please try again.",
};

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
    .select("id, name, slug, description, position, archived_at")
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
      <AdminPageHeader
        eyebrow="Merchandise"
        title="Catalog & Inventory"
        description="Manage products, categories, variants, media, pricing, and stock availability."
        actions={<>
          <CategoryDialog />
          <ProductDialog categories={categoryList} />
          <VariantDialog products={productList} />
          <ProductImageDialog products={productList} />
        </>}
      />

      {notice && (
        <div role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400">
          {catalogNotices[notice] ?? "Catalog updated."}
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {catalogErrors[error] ?? "The catalog could not be updated. Please try again."}
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
          <>
          <div className="divide-y border-t xl:hidden">
            {productList.map((product) => (
              <details key={product.id} className="group">
                <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:hidden">
                  <div className="min-w-0"><p className="truncate font-semibold">{product.name}</p><p className="truncate text-xs text-muted-foreground">{product.product_variants.length} variants · {product.product_images.length} images</p></div>
                  <div className="flex shrink-0 items-center gap-2"><Badge variant={product.status === "published" ? "default" : "secondary"} className="capitalize">{product.status}</Badge><span className="text-muted-foreground transition-transform group-open:rotate-180">⌄</span></div>
                </summary>
                <div className="space-y-5 bg-muted/20 px-4 pb-5 pt-1">
                  <div className="flex justify-between gap-3"><p className="break-all font-mono text-[10px] text-muted-foreground">{product.slug}</p><ProductDialog categories={categoryList} product={product} /></div>
                  {product.product_images.length > 0 && <div className="space-y-2"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Media</p>{product.product_images.sort((a, b) => a.position - b.position).map((image, index) => <div key={image.id} className="flex items-center justify-between gap-2 rounded-lg border bg-background p-2">
                    <div className="flex min-w-0 items-center gap-2.5"><Image src={productImageUrl(image.storage_path)} alt="" width={44} height={44} unoptimized className="size-11 rounded-md border object-cover" /><div className="min-w-0"><p className="truncate text-xs font-medium">{image.alt_text}</p><p className="text-[10px] text-muted-foreground">{index === 0 ? "Primary · " : ""}Order {image.position}</p></div></div>
                    <ProductMediaActions imageId={image.id} imageLabel={image.alt_text} index={index} count={product.product_images.length} />
                  </div>)}</div>}
                  <div className="space-y-3"><div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Variants & stock</p><VariantDialog products={productList} productId={product.id} /></div>{product.product_variants.map((variant) => {
                    const inv = Array.isArray(variant.inventory) ? variant.inventory[0] : variant.inventory;
                    const available = inv ? inv.on_hand - inv.reserved : 0;
                    return <div key={variant.id} className="space-y-3 rounded-lg border bg-background p-3">
                      <div className="flex items-start justify-between gap-2"><div><p className="text-sm font-semibold">{variant.name || variant.sku}</p><p className="font-mono text-[10px] text-muted-foreground">{variant.sku}</p></div><div className="text-right"><p className="text-sm font-semibold">{formatMinorUnitsToPHP(variant.price_minor)}</p><p className="text-xs text-muted-foreground">{available} available</p></div></div>
                      <form action={adjustInventory} className="grid grid-cols-[5rem_1fr] gap-2"><input type="hidden" name="variant_id" value={variant.id} /><input type="hidden" name="type" value="adjustment" /><Input type="number" name="delta" required placeholder="± qty" className="h-11" /><Input name="reason" required placeholder="Reason for change" className="h-11" /><Button type="submit" variant="secondary" className="col-span-2 h-11">Adjust stock</Button></form>
                    </div>;
                  })}</div>
                  <ProductOptionsPanel productId={product.id} options={product.product_options} variants={product.product_variants} />
                </div>
              </details>
            ))}
          </div>
          <div className="hidden border-t xl:block">
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
                        {product.product_images.sort((a: any, b: any) => a.position - b.position).map((image: any, index: number) => (
                          <div key={image.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/20 p-2">
                            <div className="flex min-w-0 items-center gap-2.5">
                              <Image src={productImageUrl(image.storage_path)} alt="" width={40} height={40} unoptimized className="size-10 shrink-0 rounded-md border object-cover" />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5"><span className="truncate text-xs font-medium">{image.alt_text}</span>{index === 0 && <Badge variant="secondary" className="h-5 text-[9px]">Primary</Badge>}</div>
                                <span className="text-[10px] text-muted-foreground">Display order {image.position}</span>
                              </div>
                            </div>
                            <ProductMediaActions imageId={image.id} imageLabel={image.alt_text} index={index} count={product.product_images.length} />
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
                      <div className="mb-3 flex justify-end">
                        <VariantDialog products={productList} productId={product.id} />
                      </div>
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
                      <div className="mt-4">
                        <ProductOptionsPanel productId={product.id} options={product.product_options} variants={product.product_variants} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          </>
        )}
      </Card>
    </div>
  );
}
