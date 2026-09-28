"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Category {
  id: string;
  name: string;
}

export function CatalogFilterBar({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentSearch = searchParams.get("q") || "";
  const currentCategory = searchParams.get("category") || "all";
  const currentStatus = searchParams.get("status") || "all";

  const [searchValue, setSearchValue] = React.useState(currentSearch);

  React.useEffect(() => {
    setSearchValue(currentSearch);
  }, [currentSearch]);

  const updateFilters = React.useCallback(
    (newParams: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(newParams)) {
        if (!value || value === "all") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      router.replace(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    const timeout = setTimeout(() => {
      updateFilters({ q: value.trim() || null });
    }, 300);
    return () => clearTimeout(timeout);
  };

  const activeFilterCount =
    (currentCategory !== "all" ? 1 : 0) + (currentStatus !== "all" ? 1 : 0);

  const handleReset = () => {
    setSearchValue("");
    router.replace(pathname);
  };

  return (
    <AdminFilterBar
      searchValue={searchValue}
      onSearchChange={handleSearchChange}
      searchPlaceholder="Search product, slug, or SKU..."
      activeFilterCount={activeFilterCount}
      onResetFilters={handleReset}
      filters={
        <>
          <Select
            value={currentCategory}
            onValueChange={(val) => updateFilters({ category: val })}
          >
            <SelectTrigger className="h-10 text-xs w-36 sm:w-44 bg-background" aria-label="Filter by category">
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

          <Select
            value={currentStatus}
            onValueChange={(val) => updateFilters({ status: val })}
          >
            <SelectTrigger className="h-10 text-xs w-32 bg-background" aria-label="Filter by status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </>
      }
    />
  );
}
