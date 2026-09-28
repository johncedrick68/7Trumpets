"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Package,
  Search,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminToolbar } from "@/components/admin/admin-toolbar";
import {
  AdminTableContainer,
  AdminTable,
  AdminTableHeader,
  AdminTableBody,
  AdminTableRow,
  AdminTableHead,
  AdminTableCell,
  AdminEmptyState,
} from "@/components/admin/admin-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { StockAdjustDialog } from "@/components/admin/stock-adjust-dialog";

export interface InventoryItem {
  id: string;
  sku: string;
  name: string | null;
  priceMinor: number;
  status: string;
  updatedAt: string;
  productId: string;
  productName: string;
  productSlug: string;
  categoryId: string | null;
  categoryName: string;
  primaryImage: string | null;
  onHand: number;
  reserved: number;
  safetyStock: number;
  available: number;
  isOutOfStock: boolean;
  isLowStock: boolean;
}

export interface InventoryCategory {
  id: string;
  name: string;
  slug: string;
}

interface InventoryWorkspaceProps {
  items: InventoryItem[];
  categories: InventoryCategory[];
  initialSearchQuery?: string;
  initialCategoryFilter?: string;
  initialStatusFilter?: string;
  notice?: string;
  error?: string;
}

const noticeMessages: Record<string, string> = {
  inventory_adjusted: "Inventory movement recorded and physical stock updated.",
};

const errorMessages: Record<string, string> = {
  missing_inventory_fields: "Variant, quantity delta, and a mandatory operational reason are required.",
  invalid_delta: "Stock adjustment delta must be a non-zero whole number (e.g. +10 or -5).",
  adjust_inventory_failed: "Failed to record inventory adjustment. Check database constraints or stock balance.",
};

export function InventoryWorkspace({
  items,
  categories,
  initialSearchQuery = "",
  initialCategoryFilter = "all",
  initialStatusFilter = "all",
  notice,
  error,
}: InventoryWorkspaceProps) {
  const [searchQuery, setSearchQuery] = React.useState(initialSearchQuery);
  const [categoryFilter, setCategoryFilter] = React.useState(initialCategoryFilter);
  const [statusFilter, setStatusFilter] = React.useState(initialStatusFilter);

  // Filtered items
  const filteredItems = React.useMemo(() => {
    return items.filter((item) => {
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesSku = item.sku.toLowerCase().includes(q);
        const matchesProduct = item.productName.toLowerCase().includes(q);
        const matchesVariant = item.name ? item.name.toLowerCase().includes(q) : false;
        if (!matchesSku && !matchesProduct && !matchesVariant) {
          return false;
        }
      }

      // Category filter
      if (categoryFilter !== "all" && item.categoryId !== categoryFilter) {
        return false;
      }

      // Status filter
      if (statusFilter === "out_of_stock" && !item.isOutOfStock) {
        return false;
      }
      if (statusFilter === "low_stock" && !item.isLowStock) {
        return false;
      }
      if (statusFilter === "in_stock" && (item.isOutOfStock || item.isLowStock)) {
        return false;
      }

      return true;
    });
  }, [items, searchQuery, categoryFilter, statusFilter]);

  // Aggregate metrics
  const totalVariants = items.length;
  const totalOnHand = items.reduce((sum, item) => sum + item.onHand, 0);
  const totalReserved = items.reduce((sum, item) => sum + item.reserved, 0);
  const totalAvailable = items.reduce((sum, item) => sum + item.available, 0);
  const outOfStockCount = items.filter((item) => item.isOutOfStock).length;
  const lowStockCount = items.filter((item) => item.isLowStock).length;

  const hasActiveFilters =
    searchQuery.trim() !== "" || categoryFilter !== "all" || statusFilter !== "all";

  const handleResetFilters = () => {
    setSearchQuery("");
    setCategoryFilter("all");
    setStatusFilter("all");
  };

  return (
    <div className="space-y-6">
      {/* Notice / Error banners */}
      {notice && noticeMessages[notice] && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300"
        >
          <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
          <span className="font-medium">{noticeMessages[notice]}</span>
        </div>
      )}

      {error && errorMessages[error] && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-300"
        >
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          <span className="font-medium">{errorMessages[error]}</span>
        </div>
      )}

      {/* TailAdmin Style Metrics Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="rounded-xl border border-border bg-card p-4 transition-all">
          <p className="text-xs font-medium text-muted-foreground">Tracked SKUs</p>
          <p className="mt-1 font-mono text-2xl font-bold tracking-tight text-foreground">
            {totalVariants}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Across {categories.length} categories
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 transition-all">
          <p className="text-xs font-medium text-muted-foreground">On Hand Units</p>
          <p className="mt-1 font-mono text-2xl font-bold tracking-tight text-foreground">
            {totalOnHand.toLocaleString()}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Physical warehouse inventory
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 transition-all">
          <p className="text-xs font-medium text-muted-foreground">Available to Sell</p>
          <p className="mt-1 font-mono text-2xl font-bold tracking-tight text-foreground">
            {totalAvailable.toLocaleString()}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {totalReserved.toLocaleString()} reserved for active orders
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 transition-all">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Stock Risk Alerts</p>
            {(outOfStockCount > 0 || lowStockCount > 0) && (
              <span className="flex size-2 rounded-full bg-rose-500 animate-pulse" />
            )}
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold tracking-tight text-foreground">
              {outOfStockCount + lowStockCount}
            </span>
            <span className="text-[11px] text-muted-foreground">SKUs</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {outOfStockCount} out of stock · {lowStockCount} low stock
          </p>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <AdminToolbar>
        <div className="flex flex-1 flex-col gap-2.5 sm:flex-row sm:items-center">
          {/* Search Input */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              placeholder="Search SKU, product, or variant..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9 text-xs"
              aria-label="Search inventory by SKU, product, or variant"
            />
          </div>

          {/* Category Filter */}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger aria-label="Filter inventory by category" className="h-9 w-full sm:w-[180px] text-xs">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger aria-label="Filter inventory by stock level" className="h-9 w-full sm:w-[160px] text-xs">
              <SelectValue placeholder="All Stock Levels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stock Levels</SelectItem>
              <SelectItem value="in_stock">In Stock (Normal)</SelectItem>
              <SelectItem value="low_stock">Low Stock (≤ Safety)</SelectItem>
              <SelectItem value="out_of_stock">Out of Stock (0 Units)</SelectItem>
            </SelectContent>
          </Select>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="h-9 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              <span>Reset</span>
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Showing</span>
          <strong className="font-mono font-semibold text-foreground">
            {filteredItems.length}
          </strong>
          <span>of {items.length} SKUs</span>
        </div>
      </AdminToolbar>

      {/* Main Inventory Data Table */}
      <AdminTableContainer>
        <AdminTable>
          <AdminTableHeader>
            <AdminTableRow>
              <AdminTableHead className="w-[300px]">Product & Category</AdminTableHead>
              <AdminTableHead className="w-[180px]">Variant & SKU</AdminTableHead>
              <AdminTableHead className="text-right">On Hand</AdminTableHead>
              <AdminTableHead className="text-right">Reserved</AdminTableHead>
              <AdminTableHead className="text-right">Safety Stock</AdminTableHead>
              <AdminTableHead className="text-right font-bold">Available</AdminTableHead>
              <AdminTableHead className="w-[140px]">Status</AdminTableHead>
              <AdminTableHead className="w-[130px]">Updated</AdminTableHead>
              <AdminTableHead className="text-right w-[140px]">Actions</AdminTableHead>
            </AdminTableRow>
          </AdminTableHeader>
          <AdminTableBody>
            {filteredItems.length === 0 ? (
              <AdminTableRow>
                <AdminTableCell colSpan={9} className="p-0">
                  <AdminEmptyState
                    icon={Package}
                    title="No inventory records found"
                    description={
                      hasActiveFilters
                        ? "No SKUs or variants match your active search and filter criteria."
                        : "There are no product variants currently tracked in the inventory system."
                    }
                    action={
                      hasActiveFilters ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleResetFilters}
                          className="h-8 gap-1.5 text-xs"
                        >
                          <RotateCcw className="size-3.5" aria-hidden="true" />
                          <span>Clear Filters</span>
                        </Button>
                      ) : undefined
                    }
                  />
                </AdminTableCell>
              </AdminTableRow>
            ) : (
              filteredItems.map((item) => (
                <AdminTableRow key={item.id}>
                  {/* Product & Category */}
                  <AdminTableCell>
                    <div className="flex items-center gap-3">
                      <div className="relative size-10 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                        {item.primaryImage ? (
                          <Image
                            src={item.primaryImage}
                            alt={item.productName}
                            fill
                            sizes="40px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            <Package className="size-5" aria-hidden="true" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/admin/catalog?q=${encodeURIComponent(item.productName)}`}
                          className="font-medium text-foreground hover:underline line-clamp-1 text-xs"
                        >
                          {item.productName}
                        </Link>
                        <span className="inline-block mt-0.5 text-[11px] text-muted-foreground">
                          {item.categoryName}
                        </span>
                      </div>
                    </div>
                  </AdminTableCell>

                  {/* Variant & SKU */}
                  <AdminTableCell>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground">
                        {item.name || "Default Variant"}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground uppercase">
                        {item.sku}
                      </p>
                    </div>
                  </AdminTableCell>

                  {/* On Hand */}
                  <AdminTableCell className="text-right font-mono text-xs">
                    {item.onHand}
                  </AdminTableCell>

                  {/* Reserved */}
                  <AdminTableCell className="text-right font-mono text-xs text-muted-foreground">
                    {item.reserved}
                  </AdminTableCell>

                  {/* Safety Stock */}
                  <AdminTableCell className="text-right font-mono text-xs text-muted-foreground">
                    {item.safetyStock}
                  </AdminTableCell>

                  {/* Available */}
                  <AdminTableCell className="text-right font-mono text-xs font-bold">
                    <span
                      className={
                        item.isOutOfStock
                          ? "text-rose-600 dark:text-rose-400"
                          : item.isLowStock
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-foreground"
                      }
                    >
                      {item.available}
                    </span>
                  </AdminTableCell>

                  {/* Status Badge */}
                  <AdminTableCell>
                    {item.isOutOfStock ? (
                      <StatusBadge variant="danger" dot>
                        Out of Stock
                      </StatusBadge>
                    ) : item.isLowStock ? (
                      <StatusBadge variant="warning" dot>
                        Low Stock
                      </StatusBadge>
                    ) : (
                      <StatusBadge variant="success" dot>
                        In Stock
                      </StatusBadge>
                    )}
                  </AdminTableCell>

                  {/* Last Updated */}
                  <AdminTableCell className="text-xs text-muted-foreground font-mono">
                    {new Date(item.updatedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </AdminTableCell>

                  {/* Actions */}
                  <AdminTableCell className="text-right">
                    <StockAdjustDialog
                      productName={item.productName}
                      variantId={item.id}
                      variantName={item.name}
                      sku={item.sku}
                      onHand={item.onHand}
                      reserved={item.reserved}
                      available={item.available}
                      returnTo="/admin/inventory"
                    />
                  </AdminTableCell>
                </AdminTableRow>
              ))
            )}
          </AdminTableBody>
        </AdminTable>
      </AdminTableContainer>
    </div>
  );
}
