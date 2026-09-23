import { createClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/server-log";
import { sortByMinPrice } from "@/lib/catalog/variants";

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  position: number;
}

export interface ProductSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category_id: string | null;
  min_price_minor: number;
  primary_image_path: string | null;
  is_available: boolean;
}

export interface ProductVariant {
  id: string;
  sku: string;
  name: string | null;
  price_minor: number;
  compare_at_price_minor: number | null;
  option_value_ids: string[];
  is_available: boolean;
}

export interface ProductOptionValue {
  id: string;
  option_id: string;
  value: string;
  position: number;
}

export interface ProductOption {
  id: string;
  name: string;
  position: number;
  values: ProductOptionValue[];
}

export interface ProductImage {
  id: string;
  storage_path: string;
  alt_text: string;
  position: number;
  variant_id: string | null;
}

export interface ProductDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category_id: string | null;
  primary_image_path: string | null;
  variants: ProductVariant[];
  options: ProductOption[];
  images: ProductImage[];
}

export function formatMinorUnitsToPHP(minorUnits: number): string {
  const php = minorUnits / 100;
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(php);
}

export function productImageUrl(path: string): string {
  if (path.startsWith("/") || path.startsWith("http")) {
    return path;
  }
  // Seeded catalog media ships with the application. Newly uploaded media uses
  // the public product-images bucket. Keeping both forms supported makes the
  // admin migration path safe and prevents percent-encoded filenames from
  // being encoded a second time.
  if (path.startsWith("images/")) {
    return `/${path}`;
  }
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL is required");
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `${baseUrl}/storage/v1/object/public/product-images/${encodedPath}`;
}

export async function getCategories(): Promise<Category[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, slug, description, position")
      .is("archived_at", null)
      .order("position", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      logServerError("catalog.categories", "database_failure");
      return [];
    }
    return data ?? [];
  } catch {
    return [];
  }
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, slug, description, position")
      .eq("slug", slug)
      .is("archived_at", null)
      .maybeSingle();

    if (error) {
      logServerError("catalog.category", "database_failure");
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export async function getProducts(options?: {
  categoryId?: string;
  search?: string;
  sort?: "newest" | "price_asc" | "price_desc" | "name_asc";
  availability?: "all" | "in_stock";
}): Promise<ProductSummary[]> {
  try {
    const supabase = await createClient();
    let query = supabase
      .from("products")
      .select(`
        id,
        name,
        slug,
        description,
        category_id,
        created_at,
        product_variants (
          id,
          price_minor,
          status
        ),
        product_images (
          storage_path,
          position
        )
      `)
      .eq("status", "published");

    if (options?.categoryId) {
      query = query.eq("category_id", options.categoryId);
    }

    if (options?.search && options.search.trim()) {
      query = query.ilike("name", `%${options.search.trim()}%`);
    }

    query = query.order("created_at", { ascending: false });

    const { data, error } = await query;
    if (error) {
      logServerError("catalog.products", "database_failure");
      return [];
    }

    const variantIds = (data ?? []).flatMap((item) =>
      (item.product_variants || []).map((variant) => variant.id),
    );
    const availabilityByVariant = new Map<string, boolean>();
    if (variantIds.length > 0) {
      const { data: availabilityRows, error: availabilityError } = await supabase
        .rpc("get_public_variant_availability");
      if (availabilityError) {
        logServerError("catalog.availability", "database_failure");
        return [];
      }
      for (const row of availabilityRows ?? []) {
        availabilityByVariant.set(row.variant_id, row.is_available);
      }
    }

    const items = (data ?? []).map((item) => {
      const activeVariants = (item.product_variants || []).filter(
        (v) => v.status === "active",
      );
      const prices = activeVariants.map((v) => v.price_minor);
      const minPrice = prices.length > 0 ? Math.min(...prices) : 0;

      const sortedImages = (item.product_images || []).sort(
        (a, b) => a.position - b.position,
      );

      return {
        id: item.id,
        name: item.name,
        slug: item.slug,
        description: item.description,
        category_id: item.category_id,
        min_price_minor: minPrice,
        primary_image_path: sortedImages[0] ? productImageUrl(sortedImages[0].storage_path) : null,
        is_available: activeVariants.some((variant) => availabilityByVariant.get(variant.id) === true),
      };
    });

    let result = items;
    if (options?.availability === "in_stock") {
      result = result.filter((item) => item.is_available);
    }

    if (options?.sort === "price_asc") {
      return sortByMinPrice(result, "price_asc");
    } else if (options?.sort === "price_desc") {
      return sortByMinPrice(result, "price_desc");
    } else if (options?.sort === "name_asc") {
      return [...result].sort((a, b) => a.name.localeCompare(b.name));
    }

    return result;
  } catch {
    return [];
  }
}

export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  try {
    const supabase = await createClient();
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, name, slug, description, category_id")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();

    if (productError) {
      logServerError("catalog.product", "database_failure");
      return null;
    }
    if (!product) return null;

    const [variantsRes, optionsRes, optionValuesRes, variantValuesRes, imagesRes] =
      await Promise.all([
        supabase
          .from("product_variants")
          .select("id, sku, name, price_minor, compare_at_price_minor")
          .eq("product_id", product.id)
          .eq("status", "active")
          .order("created_at", { ascending: true }),
        supabase
          .from("product_options")
          .select("id, name, position")
          .eq("product_id", product.id)
          .order("position", { ascending: true }),
        supabase
          .from("product_option_values")
          .select("id, option_id, value, position")
          .eq("product_id", product.id)
          .order("position", { ascending: true }),
        supabase
          .from("variant_option_values")
          .select("variant_id, option_value_id")
          .eq("product_id", product.id),
        supabase
          .from("product_images")
          .select("id, storage_path, alt_text, position, variant_id")
          .eq("product_id", product.id)
          .order("position", { ascending: true }),
      ]);

    if (variantsRes.error || optionsRes.error || optionValuesRes.error || variantValuesRes.error || imagesRes.error) {
      logServerError("catalog.product_relations", "database_failure");
      return null;
    }

    const variantIds = (variantsRes.data || []).map((variant) => variant.id);
    const availabilityByVariant = new Map<string, boolean>();
    if (variantIds.length > 0) {
      const { data: availabilityRows, error: availabilityError } = await supabase
        .rpc("get_public_variant_availability");
      if (availabilityError) {
        logServerError("catalog.product_availability", "database_failure");
        return null;
      }
      for (const row of availabilityRows ?? []) {
        availabilityByVariant.set(row.variant_id, row.is_available);
      }
    }

    const optionsMap: ProductOption[] = (optionsRes.data || []).map((opt) => ({
      ...opt,
      values: (optionValuesRes.data || []).filter((v) => v.option_id === opt.id),
    }));

    const images: ProductImage[] = (imagesRes.data || []).map((image) => ({
      ...image,
      storage_path: productImageUrl(image.storage_path),
    }));

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      category_id: product.category_id,
      primary_image_path: images[0]?.storage_path ?? null,
      variants: (variantsRes.data || []).map((variant) => ({
        ...variant,
        option_value_ids: (variantValuesRes.data || [])
          .filter((vv) => vv.variant_id === variant.id)
          .map((vv) => vv.option_value_id),
        is_available: availabilityByVariant.get(variant.id) ?? false,
      })),
      options: optionsMap,
      images,
    };
  } catch {
    return null;
  }
}
