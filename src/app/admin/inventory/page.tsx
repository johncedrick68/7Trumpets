import { redirect } from "next/navigation";

import { getAdminAuthContext } from "@/lib/admin/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/server-log";
import { productImageUrl } from "@/lib/catalog/queries";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminErrorState } from "@/components/admin/admin-table";
import {
  InventoryWorkspace,
  type InventoryItem,
  type InventoryCategory,
} from "@/components/admin/inventory-workspace";
import { relationToOne, relationToMany } from "@/lib/data/relations";
import {
  calculateAvailableStock,
  isInventoryOutOfStock,
  isInventoryLowStock,
} from "@/lib/inventory/stock";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams?: Promise<{
    q?: string;
    category?: string;
    status?: string;
    notice?: string;
    error?: string;
  }>;
}

export default async function AdminInventoryPage(props: PageProps) {
  const adminCtx = await getAdminAuthContext();
  if (!adminCtx) {
    redirect("/login?next=/admin/inventory");
  }

  const searchParams = await props.searchParams;
  const notice = searchParams?.notice;
  const error = searchParams?.error;
  const query = searchParams?.q?.trim();
  const categoryFilter = searchParams?.category?.trim() || "all";
  const statusFilter = searchParams?.status?.trim() || "all";

  const serviceClient = createServiceClient();

  // 1. Fetch Categories
  const { data: rawCategories, error: categoriesError } = await serviceClient
    .from("categories")
    .select("id, name, slug")
    .order("position", { ascending: true });

  if (categoriesError) {
    logServerError("admin.inventory.categories", "query_failed");
  }

  const categories: InventoryCategory[] = (rawCategories || []).map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
  }));

  // 2. Fetch Product Variants joined with Products & Inventory
  const { data: rawVariants, error: variantsError } = await serviceClient
    .from("product_variants")
    .select(`
      id,
      sku,
      name,
      price_minor,
      status,
      updated_at,
      products (
        id,
        name,
        slug,
        category_id,
        status,
        categories (
          id,
          name
        ),
        product_images (
          storage_path,
          position
        )
      ),
      inventory (
        on_hand,
        reserved,
        safety_stock,
        updated_at
      )
    `)
    .order("sku", { ascending: true });

  if (variantsError) {
    logServerError("admin.inventory.variants", "query_failed");
    return (
      <div className="space-y-6">
        <AdminPageHeader
          title="Inventory"
          description="Manage physical stock, track reservations, and log authoritative stock movements."
        />
        <div className="rounded-xl border border-border bg-card p-6">
          <AdminErrorState
            title="Unable to load inventory data"
            description="There was a problem querying variant stock levels from PostgreSQL. Please refresh the page or try again."
          />
        </div>
      </div>
    );
  }

  // 3. Normalize into InventoryItem models
  const items: InventoryItem[] = (rawVariants || []).map((v) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const product = relationToOne<any>(v.products);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const category = relationToOne<any>(product?.categories);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inventory = relationToOne<any>(v.inventory);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const images = relationToMany<any>(product?.product_images).sort(
      (a, b) => (a.position ?? 0) - (b.position ?? 0)
    );

    const onHand = Number(inventory?.on_hand ?? 0);
    const reserved = Number(inventory?.reserved ?? 0);
    const safetyStock = Number(inventory?.safety_stock ?? 0);
    const available = calculateAvailableStock(inventory);
    const isOutOfStock = isInventoryOutOfStock(inventory);
    const isLowStock = isInventoryLowStock(inventory);

    return {
      id: v.id,
      sku: v.sku,
      name: v.name,
      priceMinor: Number(v.price_minor ?? 0),
      status: v.status,
      updatedAt: inventory?.updated_at || v.updated_at,
      productId: product?.id ?? "",
      productName: product?.name ?? "Unknown Product",
      productSlug: product?.slug ?? "",
      categoryId: product?.category_id ?? null,
      categoryName: category?.name ?? "Uncategorized",
      primaryImage: images[0]?.storage_path ? productImageUrl(images[0].storage_path) : null,
      onHand,
      reserved,
      safetyStock,
      available,
      isOutOfStock,
      isLowStock,
    };
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Inventory"
        description="Manage physical stock, track reservations, and log authoritative stock movements."
      />

      <InventoryWorkspace
        items={items}
        categories={categories}
        initialSearchQuery={query}
        initialCategoryFilter={categoryFilter}
        initialStatusFilter={statusFilter}
        notice={notice}
        error={error}
      />
    </div>
  );
}
