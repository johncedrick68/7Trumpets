import { NextResponse } from "next/server";
import { getCategories, getProducts } from "@/lib/catalog/queries";
import { createClient } from "@/lib/supabase/server";
import { normalizeSearchTerm, scoreCatalogSearch } from "@/lib/catalog/search";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const query = normalizeSearchTerm(new URL(request.url).searchParams.get("q") ?? "").slice(0, 80);
  if (!query) return NextResponse.json({ results: [] });
  const skuQuery = query.replace(/[%_]/g, "");

  const supabase = await createClient();
  const [products, categories, skuResponse] = await Promise.all([
    getProducts(),
    getCategories(),
    supabase
      .from("product_variants")
      .select("product_id, sku")
      .eq("status", "active")
      .ilike("sku", `%${skuQuery}%`)
      .limit(20),
  ]);

  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const skuByProduct = new Map<string, string[]>();
  for (const row of skuResponse.data ?? []) {
    const values = skuByProduct.get(row.product_id) ?? [];
    values.push(row.sku);
    skuByProduct.set(row.product_id, values);
  }

  const results = products
    .map((product) => {
      const category = product.category_id ? categoryById.get(product.category_id) : undefined;
      const skus = skuByProduct.get(product.id) ?? [];
      return {
        product,
        category,
        score: scoreCatalogSearch(
          { name: product.name, category: category?.name ?? "", skus },
          query,
        ),
      };
    })
    .filter((item) => Number.isFinite(item.score))
    .sort((a, b) => a.score - b.score || a.product.name.localeCompare(b.product.name))
    .slice(0, 6)
    .map(({ product, category }) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      category: category?.name ?? "1968 Clothing",
      image: product.primary_image_path,
      priceMinor: product.min_price_minor,
      available: product.is_available,
    }));

  return NextResponse.json(
    { results },
    { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" } },
  );
}
