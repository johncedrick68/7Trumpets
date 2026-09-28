import { redirect } from "next/navigation";
import Image from "next/image";
import { Package, Layers } from "lucide-react";

import { adjustInventory } from "@/lib/admin/actions";
import { getAdminAuthContext } from "@/lib/admin/auth";
import { formatMinorUnitsToPHP, productImageUrl } from "@/lib/catalog/queries";
import { logServerError } from "@/lib/server-log";
import { createServiceClient } from "@/lib/supabase/server";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { CategoryDialog } from "@/components/admin/category-dialog";
import { ProductDialog } from "@/components/admin/product-dialog";
import { VariantDialog } from "@/components/admin/variant-dialog";
import { ProductImageDialog } from "@/components/admin/product-image-dialog";
import { ProductMediaActions } from "@/components/admin/product-media-actions";
import { ProductOptionsPanel } from "@/components/admin/product-options-panel";
import { CatalogFilterBar } from "@/components/admin/catalog-filter-bar";
import { StatusBadge, mapStatusToVariant } from "@/components/admin/status-badge";
import {
  AdminTableContainer,
  AdminTable,
  AdminTableHeader,
  AdminTableBody,
  AdminTableRow,
  AdminTableHead,
  AdminTableCell,
  AdminTableEmpty,
} from "@/components/admin/admin-table";
import { relationToMany, relationToOne } from "@/lib/data/relations";

export const dynamic = "force-dynamic";

const catalogNotices: Record<string, string> = {
  product_image_saved: "Product image uploaded successfully.",
  product_image_deleted: "Product image removed.",
  product_image_reordered: "Product image order updated.",
  inventory_adjusted: "Inventory movement recorded and stock updated.",
  category_saved: "Category saved successfully.",
  product_saved: "Product saved successfully.",
  variant_saved: "Variant saved successfully.",
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
  searchParams?: Promise<{ q?: string; category?: string; status?: string; notice?: string; error?: string }>;
}) {
  const adminCtx = await getAdminAuthContext();
  if (!adminCtx) {
    redirect("/login?next=/admin/catalog");
  }

  const searchParams = await props.searchParams;
  const notice = searchParams?.notice;
  const error = searchParams?.error;
  const query = searchParams?.q?.toLowerCase().trim();
  const categoryFilter = searchParams?.category;
  const statusFilter = searchParams?.status?.toLowerCase().trim();

  const serviceClient = createServiceClient();

  // Fetch categories
  const { data: categories, error: categoriesError } = await serviceClient
    .from("categories")
    .select("id, name, slug, description, position")
    .order("position", { ascending: true });

  if (categoriesError) {
    logServerError("admin.catalog.categories", "database_failure");
  }

  // Fetch products with variants, inventory status, options, and media
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

  const categoryList = categories || [];
  const categoryMap = new Map(categoryList.map((c) => [c.id, c.name]));

  const rawProductList = (products || []).map((product) => ({
    ...product,
    product_variants: relationToMany(product.product_variants).map((variant) => ({
      ...variant,
      inventory: relationToOne(variant.inventory),
      variant_option_values: relationToMany(variant.variant_option_values),
    })),
    product_options: relationToMany(product.product_options).map((option) => ({
      ...option,
      product_option_values: relationToMany(option.product_option_values),
    })),
    product_images: relationToMany(product.product_images),
  }));

  // Filter products based on searchParams
  const productList = rawProductList.filter((product) => {
    if (categoryFilter && categoryFilter !== "all" && product.category_id !== categoryFilter) {
      return false;
    }
    if (statusFilter && statusFilter !== "all" && product.status.toLowerCase() !== statusFilter) {
      return false;
    }
    if (query) {
      const matchName = product.name.toLowerCase().includes(query);
      const matchSlug = product.slug.toLowerCase().includes(query);
      const matchCat = (product.category_id && categoryMap.get(product.category_id)?.toLowerCase().includes(query)) ?? false;
      const matchSku = product.product_variants.some((v) => v.sku.toLowerCase().includes(query) || (v.name && v.name.toLowerCase().includes(query)));
      if (!matchName && !matchSlug && !matchCat && !matchSku) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="space-y-6 pb-8">
      {/* TailAdmin Canonical Page Header */}
      <AdminPageHeader
        eyebrow="Merchandise"
        title="Catalog"
        description="Manage streetwear pieces, collections, SKU variants, media order, and stock availability."
        actions={
          <div className="flex items-center gap-2">
            <CategoryDialog />
            <ProductDialog categories={categoryList} />
          </div>
        }
      />

      {/* Operational Notice Banners */}
      {notice && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs sm:text-sm font-medium text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300 shadow-xs"
        >
          {catalogNotices[notice] ?? "Catalog updated successfully."}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-xs sm:text-sm font-medium text-destructive shadow-xs"
        >
          {catalogErrors[error] ?? "The catalog could not be updated. Please try again."}
        </div>
      )}

      {/* TailAdmin Filter Bar */}
      <CatalogFilterBar categories={categoryList} />

      {/* TailAdmin Canonical Data Table */}
      <AdminTableContainer>
        <AdminTable>
          <AdminTableHeader>
            <AdminTableRow>
              <AdminTableHead className="min-w-[240px]">Product</AdminTableHead>
              <AdminTableHead>Category</AdminTableHead>
              <AdminTableHead align="left">Variants</AdminTableHead>
              <AdminTableHead align="right">Available Stock</AdminTableHead>
              <AdminTableHead align="right">Price</AdminTableHead>
              <AdminTableHead>Status</AdminTableHead>
              <AdminTableHead align="right">Actions</AdminTableHead>
            </AdminTableRow>
          </AdminTableHeader>

          <AdminTableBody>
            {productList.length === 0 ? (
              <AdminTableEmpty
                colSpan={7}
                title="No products match your criteria"
                description={
                  rawProductList.length === 0
                    ? "The catalog currently has no products. Click '+ Add Product' above to create your first streetwear piece."
                    : "No products match the active search or category filters."
                }
              />
            ) : (
              productList.map((product) => {
                const primaryImage = product.product_images.sort((a, b) => a.position - b.position)[0];
                const variantCount = product.product_variants.length;

                // Aggregate stock numbers
                const totalAvailable = product.product_variants.reduce((sum, v) => {
                  const inv = v.inventory;
                  return sum + (inv ? Math.max(0, inv.on_hand - inv.reserved) : 0);
                }, 0);

                const hasLowStock = product.product_variants.some((v) => {
                  const inv = v.inventory;
                  if (!inv) return false;
                  const avail = inv.on_hand - inv.reserved;
                  return avail > 0 && avail <= inv.safety_stock;
                });

                const hasOutOfStock =
                  product.product_variants.length > 0 &&
                  product.product_variants.some((v) => {
                    const inv = v.inventory;
                    return !inv || inv.on_hand - inv.reserved <= 0;
                  });

                // Calculate price range
                const prices = product.product_variants.map((v) => v.price_minor);
                const minPrice = prices.length ? Math.min(...prices) : null;
                const maxPrice = prices.length ? Math.max(...prices) : null;

                const priceDisplay =
                  minPrice === null || maxPrice === null
                    ? "—"
                    : minPrice === maxPrice
                    ? formatMinorUnitsToPHP(minPrice)
                    : `${formatMinorUnitsToPHP(minPrice)} – ${formatMinorUnitsToPHP(maxPrice)}`;

                return (
                  <AdminTableRow key={product.id} className="group align-top">
                    {/* Product Cell */}
                    <AdminTableCell className="min-w-[240px]">
                      <div className="flex items-start gap-3">
                        <div className="size-11 rounded-lg border border-border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                          {primaryImage ? (
                            <Image
                              src={productImageUrl(primaryImage.storage_path)}
                              alt={primaryImage.alt_text || product.name}
                              width={44}
                              height={44}
                              unoptimized
                              className="size-full object-cover"
                            />
                          ) : (
                            <Package className="size-5 text-muted-foreground" aria-hidden="true" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate max-w-xs">{product.name}</p>
                          <p className="font-mono text-[11px] text-muted-foreground truncate max-w-xs">{product.slug}</p>
                        </div>
                      </div>
                    </AdminTableCell>

                    {/* Category Cell */}
                    <AdminTableCell>
                      {product.category_id && categoryMap.has(product.category_id) ? (
                        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                          {categoryMap.get(product.category_id)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Unassigned</span>
                      )}
                    </AdminTableCell>

                    {/* Variants Count Cell */}
                    <AdminTableCell>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Layers className="size-3.5" aria-hidden="true" />
                        <span>
                          {variantCount} {variantCount === 1 ? "variant" : "variants"}
                        </span>
                      </span>
                    </AdminTableCell>

                    {/* Available Stock Cell */}
                    <AdminTableCell align="right">
                      <div className="flex flex-col items-end">
                        <span className="font-semibold tabular-nums text-foreground">
                          {totalAvailable} pcs
                        </span>
                        {hasOutOfStock ? (
                          <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                            Out of stock variant
                          </span>
                        ) : hasLowStock ? (
                          <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                            Low stock warning
                          </span>
                        ) : null}
                      </div>
                    </AdminTableCell>

                    {/* Price Range Cell */}
                    <AdminTableCell align="right">
                      <span className="font-semibold tabular-nums text-foreground">{priceDisplay}</span>
                    </AdminTableCell>

                    {/* Status Cell */}
                    <AdminTableCell>
                      <StatusBadge variant={mapStatusToVariant(product.status)}>
                        {product.status}
                      </StatusBadge>
                    </AdminTableCell>

                    {/* Actions Cell */}
                    <AdminTableCell align="right">
                      <div className="flex items-center justify-end gap-1">
                        <ProductDialog categories={categoryList} product={product} />
                        <VariantDialog products={productList} productId={product.id} />
                        <ProductImageDialog products={productList} productId={product.id} />
                      </div>
                    </AdminTableCell>
                  </AdminTableRow>
                );
              })
            )}
          </AdminTableBody>
        </AdminTable>
      </AdminTableContainer>

      {/* Detailed Operations Accordion/Section for Variants & Media */}
      <section aria-label="Product Operations and Media Details" className="space-y-4 pt-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Variants, Options &amp; Stock Ledger Details
        </h2>

        <div className="divide-y divide-border rounded-xl border border-border bg-card shadow-xs">
          {productList.map((product) => (
            <details key={`details-${product.id}`} className="group p-4 first:rounded-t-xl last:rounded-b-xl">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 marker:hidden outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
                <div className="flex items-center gap-3 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{product.name}</p>
                  <span className="text-xs text-muted-foreground">({product.product_variants.length} variants)</span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge variant={mapStatusToVariant(product.status)}>{product.status}</StatusBadge>
                  <span className="text-muted-foreground transition-transform group-open:rotate-180 text-xs">▼</span>
                </div>
              </summary>

              <div className="mt-4 space-y-6 pt-3 border-t border-border">
                {/* Media Manager Section */}
                {product.product_images.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Attached Product Images ({product.product_images.length})
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {product.product_images
                        .sort((a, b) => a.position - b.position)
                        .map((image, index) => (
                          <div
                            key={image.id}
                            className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background p-2"
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              <Image
                                src={productImageUrl(image.storage_path)}
                                alt=""
                                width={44}
                                height={44}
                                unoptimized
                                className="size-11 rounded-md border border-border object-cover shrink-0"
                              />
                              <div className="min-w-0">
                                <p className="truncate text-xs font-medium text-foreground">{image.alt_text}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {index === 0 ? "Primary · " : ""}Position {image.position}
                                </p>
                              </div>
                            </div>
                            <ProductMediaActions
                              imageId={image.id}
                              imageLabel={image.alt_text}
                              index={index}
                              count={product.product_images.length}
                            />
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Variants & Stock Adjustment Forms */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Variants &amp; Inventory Movements
                    </p>
                    <VariantDialog products={productList} productId={product.id} />
                  </div>

                  <div className="space-y-3">
                    {product.product_variants.map((variant) => {
                      const inv = variant.inventory;
                      const available = inv ? inv.on_hand - inv.reserved : 0;
                      return (
                        <div
                          key={variant.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-border bg-background p-3"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground">{variant.name || variant.sku}</p>
                            <p className="font-mono text-[11px] text-muted-foreground">{variant.sku}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs font-semibold text-foreground">
                                {formatMinorUnitsToPHP(variant.price_minor)}
                              </span>
                              <span className="text-xs text-muted-foreground">·</span>
                              <span className="text-xs text-muted-foreground">{available} available</span>
                            </div>
                          </div>

                          <form action={adjustInventory} className="flex flex-wrap items-center gap-2">
                            <input type="hidden" name="variant_id" value={variant.id} />
                            <input type="hidden" name="type" value="adjustment" />
                            <Input
                              type="number"
                              name="delta"
                              required
                              placeholder="± qty"
                              className="h-9 w-20 text-xs text-right"
                              aria-label="Adjustment quantity"
                            />
                            <Input
                              name="reason"
                              required
                              placeholder="Audit reason"
                              className="h-9 w-36 sm:w-44 text-xs"
                              aria-label="Adjustment reason"
                            />
                            <Button type="submit" variant="secondary" size="sm" className="h-9 text-xs">
                              Adjust stock
                            </Button>
                          </form>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Product Options Panel */}
                <ProductOptionsPanel
                  productId={product.id}
                  options={product.product_options}
                  variants={product.product_variants}
                />
              </div>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
