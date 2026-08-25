import { createClient } from "@/lib/supabase/server";

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
}

export interface ProductVariant {
  id: string;
  sku: string;
  name: string | null;
  price_minor: number;
  compare_at_price_minor: number | null;
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

export async function getCategories(): Promise<Category[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, slug, description, position")
      .is("archived_at", null)
      .order("position", { ascending: true })
      .order("name", { ascending: true });

    if (error || !data) return [];
    return data;
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

    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

export async function getProducts(options?: {
  categoryId?: string;
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
        product_variants (
          price_minor,
          status
        ),
        product_images (
          storage_path,
          position
        )
      `)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (options?.categoryId) {
      query = query.eq("category_id", options.categoryId);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    return data.map((item) => {
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
        primary_image_path: sortedImages[0]?.storage_path ?? null,
      };
    });
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
      .eq("status", "active")
      .maybeSingle();

    if (productError || !product) return null;

    const [variantsRes, optionsRes, optionValuesRes, imagesRes] =
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
          .from("product_images")
          .select("id, storage_path, alt_text, position, variant_id")
          .eq("product_id", product.id)
          .order("position", { ascending: true }),
      ]);

    const optionsMap: ProductOption[] = (optionsRes.data || []).map((opt) => ({
      ...opt,
      values: (optionValuesRes.data || []).filter((v) => v.option_id === opt.id),
    }));

    const images: ProductImage[] = imagesRes.data || [];

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      category_id: product.category_id,
      primary_image_path: images[0]?.storage_path ?? null,
      variants: variantsRes.data || [],
      options: optionsMap,
      images,
    };
  } catch {
    return null;
  }
}
