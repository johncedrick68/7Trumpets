"use client";

import * as React from "react";
import Image from "next/image";
import {
  ChevronDown,
  ChevronRight,
  Package,
  Layers,
} from "lucide-react";
import { formatMinorUnitsToPHP, productImageUrl } from "@/lib/catalog/queries";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { StatusBadge, mapStatusToVariant } from "@/components/admin/status-badge";
import { ProductDialog } from "@/components/admin/product-dialog";
import { VariantDialog } from "@/components/admin/variant-dialog";
import { ProductImageDialog } from "@/components/admin/product-image-dialog";
import { ProductMediaActions } from "@/components/admin/product-media-actions";
import { ProductOptionsPanel } from "@/components/admin/product-options-panel";
import { StockAdjustDialog } from "@/components/admin/stock-adjust-dialog";

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  position: number;
}

export interface InventoryRecord {
  on_hand: number;
  reserved: number;
  safety_stock: number;
}

export interface VariantRecord {
  id: string;
  sku: string;
  name: string | null;
  price_minor: number;
  compare_at_price_minor: number | null;
  status: string;
  inventory: InventoryRecord | null;
  variant_option_values: Array<{ option_id: string; option_value_id: string }>;
}

export interface ProductOptionValue {
  id: string;
  value: string;
  position: number;
}

export interface ProductOption {
  id: string;
  name: string;
  position: number;
  product_option_values: ProductOptionValue[];
}

export interface ProductImage {
  id: string;
  storage_path: string;
  alt_text: string;
  position: number;
  variant_id: string | null;
}

export interface CatalogProduct {
  id: string;
  category_id: string | null;
  name: string;
  slug: string;
  status: string;
  description: string | null;
  created_at: string;
  product_variants: VariantRecord[];
  product_options: ProductOption[];
  product_images: ProductImage[];
}

interface CatalogWorkspaceProps {
  products: CatalogProduct[];
  categories: Category[];
}

export function CatalogWorkspace({ products, categories }: CatalogWorkspaceProps) {
  const [search, setSearch] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState<string>("all");
  const [selectedStatus, setSelectedStatus] = React.useState<string>("all");
  const [selectedStock, setSelectedStock] = React.useState<string>("all");
  const [expandedProductIds, setExpandedProductIds] = React.useState<Set<string>>(new Set());

  const categoryMap = React.useMemo(() => {
    return new Map(categories.map((c) => [c.id, c.name]));
  }, [categories]);

  // Toggle row expansion
  const toggleExpand = (productId: string) => {
    setExpandedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  // Filter products based on search, category, status, and stock
  const filteredProducts = React.useMemo(() => {
    return products.filter((p) => {
      // 1. Category filter
      if (selectedCategory !== "all" && p.category_id !== selectedCategory) {
        return false;
      }

      // 2. Status filter
      if (selectedStatus !== "all" && p.status.toLowerCase() !== selectedStatus.toLowerCase()) {
        return false;
      }

      // 3. Stock metrics
      const totalAvailable = p.product_variants.reduce((sum, v) => {
        const inv = v.inventory;
        return sum + (inv ? Math.max(0, inv.on_hand - inv.reserved) : 0);
      }, 0);

      const hasLowStock = p.product_variants.some((v) => {
        const inv = v.inventory;
        if (!inv) return false;
        const avail = inv.on_hand - inv.reserved;
        return avail > 0 && avail <= inv.safety_stock;
      });

      const hasOutOfStock = p.product_variants.length > 0 && p.product_variants.some((v) => {
        const inv = v.inventory;
        return !inv || inv.on_hand - inv.reserved <= 0;
      });

      if (selectedStock === "out_of_stock" && !hasOutOfStock) {
        return false;
      }
      if (selectedStock === "low_stock" && !hasLowStock) {
        return false;
      }
      if (selectedStock === "in_stock" && (hasOutOfStock || totalAvailable <= 0)) {
        return false;
      }

      // 4. Text search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesSlug = p.slug.toLowerCase().includes(q);
        const matchesCategory = (p.category_id && categoryMap.get(p.category_id)?.toLowerCase().includes(q)) ?? false;
        const matchesSku = p.product_variants.some((v) => v.sku.toLowerCase().includes(q) || (v.name && v.name.toLowerCase().includes(q)));

        if (!matchesName && !matchesSlug && !matchesCategory && !matchesSku) {
          return false;
        }
      }

      return true;
    });
  }, [products, search, selectedCategory, selectedStatus, selectedStock, categoryMap]);

  const activeFilterCount =
    (selectedCategory !== "all" ? 1 : 0) +
    (selectedStatus !== "all" ? 1 : 0) +
    (selectedStock !== "all" ? 1 : 0);

  const handleResetFilters = () => {
    setSearch("");
    setSelectedCategory("all");
    setSelectedStatus("all");
    setSelectedStock("all");
  };

  return (
    <div className="space-y-4">
      {/* TailAdmin Canonical Filter Bar */}
      <AdminFilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search product, slug, or SKU..."
        activeFilterCount={activeFilterCount}
        onResetFilters={handleResetFilters}
        filters={
          <>
            {/* Category Select */}
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="h-10 text-xs w-36 sm:w-44 bg-background">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Select */}
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="h-10 text-xs w-32 bg-background">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>

            {/* Stock Filter */}
            <Select value={selectedStock} onValueChange={setSelectedStock}>
              <SelectTrigger className="h-10 text-xs w-36 bg-background">
                <SelectValue placeholder="Stock Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stock</SelectItem>
                <SelectItem value="low_stock">Low Stock Alerts</SelectItem>
                <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                <SelectItem value="in_stock">Healthy Stock</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />

      {/* Main Catalog Table */}
      <AdminTableContainer>
        <AdminTable>
          <AdminTableHeader>
            <AdminTableRow>
              <AdminTableHead className="w-10 px-2" />
              <AdminTableHead className="min-w-[220px]">Product</AdminTableHead>
              <AdminTableHead>Category</AdminTableHead>
              <AdminTableHead align="left">Variants</AdminTableHead>
              <AdminTableHead align="right">Available Stock</AdminTableHead>
              <AdminTableHead align="right">Price</AdminTableHead>
              <AdminTableHead>Status</AdminTableHead>
              <AdminTableHead align="right">Actions</AdminTableHead>
            </AdminTableRow>
          </AdminTableHeader>

          <AdminTableBody>
            {filteredProducts.length === 0 ? (
              <AdminTableEmpty
                colSpan={8}
                title="No products match your criteria"
                description={
                  products.length === 0
                    ? "The catalog currently has no products. Click '+ Add Product' above to create your first streetwear piece."
                    : "No products matched the active search or category filters. Try resetting your search."
                }
                action={
                  activeFilterCount > 0 || search ? (
                    <Button variant="outline" size="sm" onClick={handleResetFilters}>
                      Clear all filters
                    </Button>
                  ) : null
                }
              />
            ) : (
              filteredProducts.map((product) => {
                const isExpanded = expandedProductIds.has(product.id);
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
                  <React.Fragment key={product.id}>
                    {/* Primary Product Row */}
                    <AdminTableRow className={isExpanded ? "bg-muted/30" : undefined}>
                      {/* Expansion Chevron */}
                      <AdminTableCell className="px-2 w-10">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleExpand(product.id)}
                          className="size-8 text-muted-foreground hover:text-foreground"
                          aria-label={isExpanded ? "Collapse product variants" : "Expand product variants"}
                          aria-expanded={isExpanded}
                        >
                          {isExpanded ? (
                            <ChevronDown className="size-4" aria-hidden="true" />
                          ) : (
                            <ChevronRight className="size-4" aria-hidden="true" />
                          )}
                        </Button>
                      </AdminTableCell>

                      {/* Product Thumbnail & Details */}
                      <AdminTableCell className="min-w-[220px]">
                        <div className="flex items-center gap-3">
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

                      {/* Category */}
                      <AdminTableCell>
                        {product.category_id && categoryMap.has(product.category_id) ? (
                          <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                            {categoryMap.get(product.category_id)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Unassigned</span>
                        )}
                      </AdminTableCell>

                      {/* Variants Count */}
                      <AdminTableCell>
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Layers className="size-3.5" aria-hidden="true" />
                          <span>
                            {variantCount} {variantCount === 1 ? "variant" : "variants"}
                          </span>
                        </span>
                      </AdminTableCell>

                      {/* Available Stock */}
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

                      {/* Price Range */}
                      <AdminTableCell align="right">
                        <span className="font-semibold tabular-nums text-foreground">{priceDisplay}</span>
                      </AdminTableCell>

                      {/* Status */}
                      <AdminTableCell>
                        <StatusBadge variant={mapStatusToVariant(product.status)}>
                          {product.status}
                        </StatusBadge>
                      </AdminTableCell>

                      {/* Row Actions */}
                      <AdminTableCell align="right">
                        <div className="flex items-center justify-end gap-1">
                          <ProductDialog categories={categories} product={product} />
                          <VariantDialog products={products} productId={product.id} />
                          <ProductImageDialog products={products} productId={product.id} />
                        </div>
                      </AdminTableCell>
                    </AdminTableRow>

                    {/* Expandable Sub-table for Variants, Media & Stock */}
                    {isExpanded && (
                      <AdminTableRow className="bg-muted/15 border-b-2 border-border/80 hover:bg-muted/20">
                        <td colSpan={8} className="p-4 sm:p-6 space-y-6">
                          {/* Section Header */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Product Specifications & Stock Ledger
                              </p>
                              <p className="text-sm font-semibold text-foreground">
                                {product.name} ({variantCount} Active Variants)
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <VariantDialog products={products} productId={product.id} />
                              <ProductImageDialog products={products} productId={product.id} />
                            </div>
                          </div>

                          {/* 1. Variant Ledger Table */}
                          <div className="space-y-3">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Variant Stock & Quick Adjustments
                            </p>
                            {product.product_variants.length === 0 ? (
                              <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                                No variants added to this product yet. Click &quot;Add Variant&quot; to configure sizing and stock.
                              </div>
                            ) : (
                              <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-xs">
                                <table className="w-full text-left text-xs border-collapse">
                                  <thead className="bg-muted/60 text-muted-foreground border-b border-border">
                                    <tr>
                                      <th className="px-3 py-2.5 font-semibold">Option / Name</th>
                                      <th className="px-3 py-2.5 font-semibold font-mono">SKU</th>
                                      <th className="px-3 py-2.5 font-semibold text-right">Price</th>
                                      <th className="px-3 py-2.5 font-semibold text-right">On Hand</th>
                                      <th className="px-3 py-2.5 font-semibold text-right">Reserved</th>
                                      <th className="px-3 py-2.5 font-semibold text-right">Available</th>
                                      <th className="px-3 py-2.5 font-semibold">Stock Health</th>
                                      <th className="px-3 py-2.5 font-semibold text-right">Quick Stock Adjustment</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border">
                                    {product.product_variants.map((variant) => {
                                      const inv = variant.inventory;
                                      const onHand = inv?.on_hand ?? 0;
                                      const reserved = inv?.reserved ?? 0;
                                      const safety = inv?.safety_stock ?? 0;
                                      const available = onHand - reserved;
                                      const isOut = available <= 0;
                                      const isLow = available > 0 && available <= safety;

                                      return (
                                        <tr key={variant.id} className="hover:bg-muted/30 transition-colors">
                                          <td className="px-3 py-2.5 font-medium text-foreground">
                                            {variant.name || "Default Option"}
                                          </td>
                                          <td className="px-3 py-2.5 font-mono text-muted-foreground">
                                            {variant.sku}
                                          </td>
                                          <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-foreground">
                                            {formatMinorUnitsToPHP(variant.price_minor)}
                                          </td>
                                          <td className="px-3 py-2.5 text-right tabular-nums text-foreground">
                                            {onHand}
                                          </td>
                                          <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                                            {reserved}
                                          </td>
                                          <td className="px-3 py-2.5 text-right tabular-nums font-bold text-foreground">
                                            {available}
                                          </td>
                                          <td className="px-3 py-2.5">
                                            <StatusBadge
                                              variant={isOut ? "danger" : isLow ? "warning" : "success"}
                                            >
                                              {isOut ? "Out of Stock" : isLow ? `Low (${available})` : "Healthy"}
                                            </StatusBadge>
                                          </td>
                                          {/* Focused TailAdmin Stock Adjustment Modal */}
                                          <td className="px-3 py-2 text-right">
                                            <StockAdjustDialog
                                              productName={product.name}
                                              variantId={variant.id}
                                              variantName={variant.name}
                                              sku={variant.sku}
                                              onHand={onHand}
                                              reserved={reserved}
                                              available={available}
                                            />
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>

                          {/* 2. Media Gallery Overview */}
                          {product.product_images.length > 0 && (
                            <div className="space-y-3">
                              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Attached Product Images ({product.product_images.length})
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                {product.product_images
                                  .sort((a, b) => a.position - b.position)
                                  .map((img, idx) => (
                                    <div
                                      key={img.id}
                                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-2 shadow-xs"
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <Image
                                          src={productImageUrl(img.storage_path)}
                                          alt={img.alt_text || ""}
                                          width={40}
                                          height={40}
                                          unoptimized
                                          className="size-10 rounded-md border border-border object-cover shrink-0"
                                        />
                                        <div className="min-w-0">
                                          <p className="truncate text-xs font-medium text-foreground">
                                            {img.alt_text || "Product image"}
                                          </p>
                                          <p className="text-[10px] text-muted-foreground">
                                            {idx === 0 ? "Primary Image · " : ""}Position {img.position}
                                          </p>
                                        </div>
                                      </div>
                                      <ProductMediaActions
                                        imageId={img.id}
                                        imageLabel={img.alt_text}
                                        index={idx}
                                        count={product.product_images.length}
                                      />
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}

                          {/* 3. Product Options Specification */}
                          <ProductOptionsPanel
                            productId={product.id}
                            options={product.product_options}
                            variants={product.product_variants}
                          />
                        </td>
                      </AdminTableRow>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </AdminTableBody>
        </AdminTable>
      </AdminTableContainer>
    </div>
  );
}
