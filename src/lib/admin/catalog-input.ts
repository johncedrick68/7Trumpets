/**
 * Catalog Input Validation and Preservation Helpers
 *
 * Enforces:
 * 1. Strict PostgreSQL canonical UUID validation for optional and required IDs.
 * 2. Normalization of documented "none" and blank optional relationships to null.
 * 3. Exact field preservation on updates (distinguishing omitted fields from explicit clear/empty/false/0).
 * 4. Status allowlists for products ('draft', 'published', 'archived') and variants ('active', 'inactive', 'archived').
 */

import { randomUUID } from "node:crypto";

export function parsePHPMinor(value: string): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return null;

  const minor = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(minor) ? minor : null;
}

export const CANONICAL_UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const PRODUCT_STATUSES = ["draft", "published", "archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const VARIANT_STATUSES = ["active", "inactive", "archived"] as const;
export type VariantStatus = (typeof VARIANT_STATUSES)[number];

/**
 * Validates an optional UUID parameter.
 * - Absent, null, undefined, empty string, or "none" sentinel -> valid null.
 * - Valid canonical UUID string -> valid string.
 * - Non-empty non-UUID or non-string -> invalid (fails closed).
 */
export function parseOptionalUuid(raw: unknown): { valid: boolean; value: string | null } {
  if (raw === null || raw === undefined) {
    return { valid: true, value: null };
  }
  if (typeof raw !== "string") {
    return { valid: false, value: null };
  }
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed.toLowerCase() === "none") {
    return { valid: true, value: null };
  }
  if (CANONICAL_UUID_REGEX.test(trimmed)) {
    return { valid: true, value: trimmed };
  }
  return { valid: false, value: null };
}

/**
 * Validates a required UUID parameter.
 * - Must be a non-empty string matching canonical UUID format.
 * - Sentinels ("none", "all"), blanks, and malformed strings fail closed.
 */
export function parseRequiredUuid(raw: unknown): { valid: boolean; value: string | null } {
  if (typeof raw !== "string") {
    return { valid: false, value: null };
  }
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed.toLowerCase() === "none" || trimmed.toLowerCase() === "all") {
    return { valid: false, value: null };
  }
  if (CANONICAL_UUID_REGEX.test(trimmed)) {
    return { valid: true, value: trimmed };
  }
  return { valid: false, value: null };
}

export interface ExistingProductRecord {
  id: string;
  category_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  status: string;
}

export interface ResolvedProductPayload {
  id?: string;
  category_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  status: ProductStatus;
}

/**
 * Resolves product creation or update payload.
 * When existing record is provided, omitted form fields preserve existing values,
 * while explicit empty/clear values apply.
 */
export function resolveProductPayload(
  formData: FormData,
  existing?: ExistingProductRecord | null
): { valid: boolean; error?: string; payload?: ResolvedProductPayload } {
  // 1. Name
  let name: string;
  if (formData.has("name")) {
    name = String(formData.get("name") ?? "").trim();
    if (!name) return { valid: false, error: "missing_product_fields" };
  } else if (existing) {
    name = existing.name;
  } else {
    return { valid: false, error: "missing_product_fields" };
  }

  // 2. Slug
  let slug: string;
  if (formData.has("slug")) {
    slug = String(formData.get("slug") ?? "").trim().toLowerCase();
    if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return { valid: false, error: "invalid_product_slug" };
    }
  } else if (existing) {
    slug = existing.slug;
  } else {
    return { valid: false, error: "missing_product_fields" };
  }

  // 3. Category ID (optional)
  let categoryId: string | null;
  if (formData.has("category_id")) {
    const parsedCat = parseOptionalUuid(formData.get("category_id"));
    if (!parsedCat.valid) {
      return { valid: false, error: "invalid_category_id" };
    }
    categoryId = parsedCat.value;
  } else if (existing) {
    categoryId = existing.category_id;
  } else {
    categoryId = null;
  }

  // 4. Description (optional)
  let description: string | null;
  if (formData.has("description")) {
    const rawDesc = String(formData.get("description") ?? "").trim();
    description = rawDesc === "" ? null : rawDesc;
  } else if (existing) {
    description = existing.description;
  } else {
    description = null;
  }

  // 5. Status
  let status: ProductStatus;
  if (formData.has("status")) {
    const rawStatus = String(formData.get("status") ?? "").trim().toLowerCase();
    if (!PRODUCT_STATUSES.includes(rawStatus as ProductStatus)) {
      return { valid: false, error: "invalid_product_status" };
    }
    status = rawStatus as ProductStatus;
  } else if (existing) {
    status = (existing.status as ProductStatus) || "draft";
  } else {
    status = "draft";
  }

  return {
    valid: true,
    payload: {
      id: existing?.id,
      category_id: categoryId,
      name,
      slug,
      description,
      status,
    },
  };
}

export interface ExistingCategoryRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  position: number;
  archived_at: string | null;
}

export interface ResolvedCategoryPayload {
  id?: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  position: number;
  archived: boolean;
}

/**
 * Resolves category creation or update payload.
 * Distinguishes omitted edit fields from explicit empty/clear/false/0.
 */
export function resolveCategoryPayload(
  formData: FormData,
  existing?: ExistingCategoryRecord | null
): { valid: boolean; error?: string; payload?: ResolvedCategoryPayload } {
  // 1. Name
  let name: string;
  if (formData.has("name")) {
    name = String(formData.get("name") ?? "").trim();
    if (!name) return { valid: false, error: "missing_category_fields" };
  } else if (existing) {
    name = existing.name;
  } else {
    return { valid: false, error: "missing_category_fields" };
  }

  // 2. Slug
  let slug: string;
  if (formData.has("slug")) {
    slug = String(formData.get("slug") ?? "").trim().toLowerCase();
    if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return { valid: false, error: "invalid_category_slug" };
    }
  } else if (existing) {
    slug = existing.slug;
  } else {
    return { valid: false, error: "missing_category_fields" };
  }

  // 3. Description
  let description: string | null;
  if (formData.has("description")) {
    const rawDesc = String(formData.get("description") ?? "").trim();
    description = rawDesc === "" ? null : rawDesc;
  } else if (existing) {
    description = existing.description;
  } else {
    description = null;
  }

  // 4. Parent ID
  let parentId: string | null;
  if (formData.has("parent_id")) {
    const parsedParent = parseOptionalUuid(formData.get("parent_id"));
    if (!parsedParent.valid) {
      return { valid: false, error: "invalid_parent_id" };
    }
    if (existing && parsedParent.value === existing.id) {
      return { valid: false, error: "category_cannot_be_parent_of_itself" };
    }
    parentId = parsedParent.value;
  } else if (existing) {
    parentId = existing.parent_id;
  } else {
    parentId = null;
  }

  // 5. Position (preserves valid 0)
  let position: number;
  if (formData.has("position")) {
    const rawPos = String(formData.get("position") ?? "").trim();
    const parsed = Number.parseInt(rawPos, 10);
    if (!Number.isInteger(parsed)) {
      return { valid: false, error: "invalid_position" };
    }
    position = parsed;
  } else if (existing) {
    position = existing.position ?? 0;
  } else {
    position = 0;
  }

  // 6. Archived
  let archived: boolean;
  if (formData.has("archived")) {
    const rawArch = String(formData.get("archived") ?? "").trim().toLowerCase();
    if (rawArch === "true" || rawArch === "on" || rawArch === "1") {
      archived = true;
    } else if (rawArch === "false" || rawArch === "off" || rawArch === "0" || rawArch === "") {
      archived = false;
    } else {
      return { valid: false, error: "invalid_archived_value" };
    }
  } else if (existing) {
    archived = Boolean(existing.archived_at);
  } else {
    archived = false;
  }

  return {
    valid: true,
    payload: {
      id: existing?.id,
      name,
      slug,
      description,
      parent_id: parentId,
      position,
      archived,
    },
  };
}

export interface ExistingVariantRecord {
  id: string;
  product_id: string;
  sku: string;
  name: string | null;
  price_minor: number;
  compare_at_price_minor: number | null;
  status: string;
}

export interface ResolvedVariantPayload {
  id?: string;
  product_id: string;
  sku: string;
  name: string | null;
  price_minor: number;
  compare_at_price_minor: number | null;
  status: VariantStatus;
}

/**
 * Validates variant status against allowlist: 'active', 'inactive', 'archived'.
 * Rejects 'draft' and invalid values.
 */
export function validateVariantStatus(status: unknown): VariantStatus | null {
  if (typeof status !== "string") return null;
  const trimmed = status.trim().toLowerCase();
  if (VARIANT_STATUSES.includes(trimmed as VariantStatus)) {
    return trimmed as VariantStatus;
  }
  return null;
}

export interface CatalogActionAdapter {
  requireAdminAal2: (returnTo?: string) => Promise<unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getSupabase: () => Promise<any> | any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getServiceClient?: () => any;
  inspectImage?: (buffer: Buffer) => { mime: string } | null;
  redirect: (url: string) => never;
  revalidatePath?: (path: string) => void;
  logServerError?: (domain: string, reason: string) => void;
}

export async function executeSaveCategory(
  formData: FormData,
  adapter: CatalogActionAdapter
): Promise<never> {
  await adapter.requireAdminAal2("/admin/catalog");

  const rawId = formData.get("id");
  const parsedId = parseOptionalUuid(rawId);
  if (!parsedId.valid) {
    return adapter.redirect("/admin/catalog?error=invalid_category_id");
  }

  const supabase = await adapter.getSupabase();
  let existing: ExistingCategoryRecord | null = null;

  if (parsedId.value) {
    const { data, error: readError } = await supabase
      .from("categories")
      .select("id, name, slug, description, parent_id, position, archived_at")
      .eq("id", parsedId.value)
      .maybeSingle();

    if (readError || !data) {
      adapter.logServerError?.("admin.saveCategory", "existing_category_not_found");
      return adapter.redirect("/admin/catalog?error=category_not_found");
    }
    existing = data as ExistingCategoryRecord;
  }

  const resolved = resolveCategoryPayload(formData, existing);
  if (!resolved.valid || !resolved.payload) {
    return adapter.redirect(`/admin/catalog?error=${resolved.error || "invalid_category_payload"}`);
  }

  const { payload } = resolved;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.rpc as any)("admin_save_category", {
    p_id: payload.id ?? null,
    p_name: payload.name,
    p_slug: payload.slug,
    p_description: payload.description,
    p_parent_id: payload.parent_id,
    p_position: payload.position,
    p_archived: payload.archived,
  });

  if (error) {
    adapter.logServerError?.("admin.saveCategory", "rpc_error");
    return adapter.redirect("/admin/catalog?error=save_category_failed");
  }

  adapter.revalidatePath?.("/admin/catalog");
  adapter.revalidatePath?.("/categories");
  return adapter.redirect("/admin/catalog?notice=category_saved");
}

export async function executeSaveProduct(
  formData: FormData,
  adapter: CatalogActionAdapter
): Promise<never> {
  await adapter.requireAdminAal2("/admin/catalog");

  const rawId = formData.get("id");
  const parsedId = parseOptionalUuid(rawId);
  if (!parsedId.valid) {
    return adapter.redirect("/admin/catalog?error=invalid_product_id");
  }

  const supabase = await adapter.getSupabase();
  let existing: ExistingProductRecord | null = null;

  if (parsedId.value) {
    const { data, error: readError } = await supabase
      .from("products")
      .select("id, category_id, name, slug, description, status")
      .eq("id", parsedId.value)
      .maybeSingle();

    if (readError || !data) {
      adapter.logServerError?.("admin.saveProduct", "existing_product_not_found");
      return adapter.redirect("/admin/catalog?error=product_not_found");
    }
    existing = data as ExistingProductRecord;
  }

  const resolved = resolveProductPayload(formData, existing);
  if (!resolved.valid || !resolved.payload) {
    return adapter.redirect(`/admin/catalog?error=${resolved.error || "invalid_product_payload"}`);
  }

  const { payload } = resolved;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.rpc as any)("admin_save_product", {
    p_id: payload.id ?? null,
    p_category_id: payload.category_id,
    p_name: payload.name,
    p_slug: payload.slug,
    p_description: payload.description,
    p_status: payload.status,
  });

  if (error) {
    adapter.logServerError?.("admin.saveProduct", "rpc_error");
    return adapter.redirect("/admin/catalog?error=save_product_failed");
  }

  adapter.revalidatePath?.("/admin/catalog");
  adapter.revalidatePath?.("/products");
  return adapter.redirect("/admin/catalog?notice=product_saved");
}

export async function executeSaveVariant(
  formData: FormData,
  adapter: CatalogActionAdapter
): Promise<never> {
  await adapter.requireAdminAal2("/admin/catalog");

  const parsedVariantId = parseOptionalUuid(formData.get("id"));
  if (!parsedVariantId.valid) {
    return adapter.redirect("/admin/catalog?error=invalid_variant_id");
  }

  const parsedProductId = parseRequiredUuid(formData.get("product_id"));
  if (!parsedProductId.valid) {
    return adapter.redirect("/admin/catalog?error=invalid_product_id");
  }
  const productId = parsedProductId.value!;

  const supabase = await adapter.getSupabase();

  if (parsedVariantId.value) {
    const { data: existingVariant, error: variantReadError } = await supabase
      .from("product_variants")
      .select("id, product_id, sku, name, price_minor, compare_at_price_minor, status")
      .eq("id", parsedVariantId.value)
      .maybeSingle();

    if (variantReadError || !existingVariant) {
      adapter.logServerError?.("admin.saveVariant", "existing_variant_not_found");
      return adapter.redirect("/admin/catalog?error=variant_not_found");
    }

    if (existingVariant.product_id !== productId) {
      adapter.logServerError?.("admin.saveVariant", "product_reparenting_not_allowed");
      return adapter.redirect("/admin/catalog?error=variant_product_mismatch");
    }
  }

  const rawSku = formData.get("sku");
  if (typeof rawSku !== "string" || !rawSku.trim()) {
    return adapter.redirect("/admin/catalog?error=missing_variant_fields");
  }
  const sku = rawSku.trim().toUpperCase();

  const rawPrice = formData.get("price");
  if (typeof rawPrice !== "string" || !rawPrice.trim()) {
    return adapter.redirect("/admin/catalog?error=missing_variant_fields");
  }
  const priceMinor = parsePHPMinor(rawPrice.trim());
  if (priceMinor === null || priceMinor < 0) {
    return adapter.redirect("/admin/catalog?error=invalid_price");
  }

  let compareAtPriceMinor: number | null = null;
  const rawCompareAt = formData.get("compare_at_price");
  if (typeof rawCompareAt === "string" && rawCompareAt.trim()) {
    const parsed = parsePHPMinor(rawCompareAt.trim());
    if (parsed === null || parsed < priceMinor) {
      return adapter.redirect("/admin/catalog?error=invalid_compare_at_price");
    }
    compareAtPriceMinor = parsed;
  }

  const rawName = formData.get("name");
  const name = typeof rawName === "string" && rawName.trim() ? rawName.trim() : null;

  const rawStatus = formData.get("status");
  const status = validateVariantStatus(rawStatus ?? "active");
  if (!status) {
    return adapter.redirect("/admin/catalog?error=invalid_variant_status");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.rpc as any)("admin_save_variant", {
    p_id: parsedVariantId.value ?? null,
    p_product_id: productId,
    p_sku: sku,
    p_name: name,
    p_price_minor: priceMinor,
    p_compare_at_price_minor: compareAtPriceMinor,
    p_status: status,
  });

  if (error) {
    adapter.logServerError?.("admin.saveVariant", "rpc_error");
    return adapter.redirect("/admin/catalog?error=save_variant_failed");
  }

  adapter.revalidatePath?.("/admin/catalog");
  adapter.revalidatePath?.("/products");
  return adapter.redirect("/admin/catalog?notice=variant_saved");
}

export async function executeSaveProductOption(
  formData: FormData,
  adapter: CatalogActionAdapter
): Promise<never> {
  await adapter.requireAdminAal2("/admin/catalog");

  const parsedProductId = parseRequiredUuid(formData.get("product_id"));
  if (!parsedProductId.valid) {
    return adapter.redirect("/admin/catalog?error=invalid_product_id");
  }

  const rawName = formData.get("name");
  if (typeof rawName !== "string" || !rawName.trim()) {
    return adapter.redirect("/admin/catalog?error=invalid_option");
  }
  const name = rawName.trim();

  const rawPos = formData.get("position");
  const posStr = typeof rawPos === "string" && rawPos.trim() !== "" ? rawPos.trim() : "0";
  const position = Number.parseInt(posStr, 10);
  if (!Number.isInteger(position)) {
    return adapter.redirect("/admin/catalog?error=invalid_position");
  }

  const parsedOptionId = parseOptionalUuid(formData.get("id"));
  if (!parsedOptionId.valid) {
    return adapter.redirect("/admin/catalog?error=invalid_option_id");
  }

  const supabase = await adapter.getSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.rpc as any)("admin_save_product_option", {
    p_product_id: parsedProductId.value!,
    p_name: name,
    p_id: parsedOptionId.value ?? null,
    p_position: position,
  });

  if (error) {
    adapter.logServerError?.("admin.saveProductOption", "rpc_error");
    return adapter.redirect("/admin/catalog?error=save_option_failed");
  }

  adapter.revalidatePath?.("/admin/catalog");
  return adapter.redirect("/admin/catalog?notice=option_saved");
}

export async function executeSaveOptionValue(
  formData: FormData,
  adapter: CatalogActionAdapter
): Promise<never> {
  await adapter.requireAdminAal2("/admin/catalog");

  const parsedProductId = parseRequiredUuid(formData.get("product_id"));
  if (!parsedProductId.valid) {
    return adapter.redirect("/admin/catalog?error=invalid_product_id");
  }

  const parsedOptionId = parseRequiredUuid(formData.get("option_id"));
  if (!parsedOptionId.valid) {
    return adapter.redirect("/admin/catalog?error=invalid_option_id");
  }

  const rawVal = formData.get("value");
  if (typeof rawVal !== "string" || !rawVal.trim()) {
    return adapter.redirect("/admin/catalog?error=invalid_option_value");
  }
  const value = rawVal.trim();

  const rawPos = formData.get("position");
  const posStr = typeof rawPos === "string" && rawPos.trim() !== "" ? rawPos.trim() : "0";
  const position = Number.parseInt(posStr, 10);
  if (!Number.isInteger(position)) {
    return adapter.redirect("/admin/catalog?error=invalid_position");
  }

  const parsedValueId = parseOptionalUuid(formData.get("id"));
  if (!parsedValueId.valid) {
    return adapter.redirect("/admin/catalog?error=invalid_option_value_id");
  }

  const supabase = await adapter.getSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.rpc as any)("admin_save_option_value", {
    p_product_id: parsedProductId.value!,
    p_option_id: parsedOptionId.value!,
    p_value: value,
    p_id: parsedValueId.value ?? null,
    p_position: position,
  });

  if (error) {
    adapter.logServerError?.("admin.saveOptionValue", "rpc_error");
    return adapter.redirect("/admin/catalog?error=save_option_value_failed");
  }

  adapter.revalidatePath?.("/admin/catalog");
  return adapter.redirect("/admin/catalog?notice=option_value_saved");
}

export async function executeSetVariantOptionValue(
  formData: FormData,
  adapter: CatalogActionAdapter
): Promise<never> {
  await adapter.requireAdminAal2("/admin/catalog");

  const parsedProductId = parseRequiredUuid(formData.get("product_id"));
  if (!parsedProductId.valid) {
    return adapter.redirect("/admin/catalog?error=invalid_product_id");
  }

  const parsedVariantId = parseRequiredUuid(formData.get("variant_id"));
  if (!parsedVariantId.valid) {
    return adapter.redirect("/admin/catalog?error=invalid_variant_id");
  }

  const parsedOptionId = parseRequiredUuid(formData.get("option_id"));
  if (!parsedOptionId.valid) {
    return adapter.redirect("/admin/catalog?error=invalid_option_id");
  }

  const parsedValueId = parseRequiredUuid(formData.get("option_value_id"));
  if (!parsedValueId.valid) {
    return adapter.redirect("/admin/catalog?error=invalid_option_value_id");
  }

  const supabase = await adapter.getSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.rpc as any)("admin_set_variant_option_value", {
    p_product_id: parsedProductId.value!,
    p_variant_id: parsedVariantId.value!,
    p_option_id: parsedOptionId.value!,
    p_option_value_id: parsedValueId.value!,
  });

  if (error) {
    adapter.logServerError?.("admin.setVariantOptionValue", "rpc_error");
    return adapter.redirect("/admin/catalog?error=set_variant_option_failed");
  }

  adapter.revalidatePath?.("/admin/catalog");
  return adapter.redirect("/admin/catalog?notice=variant_option_saved");
}

export async function executeSaveProductImage(
  formData: FormData,
  adapter: CatalogActionAdapter
): Promise<never> {
  await adapter.requireAdminAal2("/admin/catalog");

  const parsedProductId = parseRequiredUuid(formData.get("product_id"));
  if (!parsedProductId.valid) {
    return adapter.redirect("/admin/catalog?error=invalid_product_id");
  }
  const productId = parsedProductId.value!;

  const parsedVariantId = parseOptionalUuid(formData.get("variant_id"));
  if (!parsedVariantId.valid) {
    return adapter.redirect("/admin/catalog?error=invalid_variant_id");
  }
  const variantId = parsedVariantId.value;

  const rawAlt = formData.get("alt_text");
  if (typeof rawAlt !== "string" || !rawAlt.trim()) {
    return adapter.redirect("/admin/catalog?error=invalid_alt_text");
  }
  const altText = rawAlt.trim();

  const rawPos = formData.get("position");
  const posStr = typeof rawPos === "string" && rawPos.trim() !== "" ? rawPos.trim() : "0";
  const position = Number.parseInt(posStr, 10);
  if (!Number.isInteger(position)) {
    return adapter.redirect("/admin/catalog?error=invalid_position");
  }

  const file = formData.get("image");
  if (!(file instanceof File) || file.size <= 0 || file.size > 5 * 1024 * 1024) {
    return adapter.redirect("/admin/catalog?error=invalid_product_image");
  }

  // Pre-validate product and product-variant relationship before ANY storage upload
  const supabase = await adapter.getSupabase();
  const { data: product, error: productErr } = await supabase
    .from("products")
    .select("id")
    .eq("id", productId)
    .maybeSingle();

  if (productErr || !product) {
    adapter.logServerError?.("admin.saveProductImage", "product_not_found");
    return adapter.redirect("/admin/catalog?error=product_not_found");
  }

  if (variantId) {
    const { data: variant, error: variantErr } = await supabase
      .from("product_variants")
      .select("id, product_id")
      .eq("id", variantId)
      .eq("product_id", productId)
      .maybeSingle();

    if (variantErr || !variant) {
      adapter.logServerError?.("admin.saveProductImage", "variant_product_mismatch");
      return adapter.redirect("/admin/catalog?error=variant_product_mismatch");
    }
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const inspector = adapter.inspectImage;
  const image = inspector ? inspector(buffer) : null;
  if (!image || image.mime !== "image/webp" || file.type !== "image/webp") {
    return adapter.redirect("/admin/catalog?error=product_image_must_be_webp");
  }

  const storagePath = `${productId}/${randomUUID()}.webp`;
  const serviceClient = adapter.getServiceClient ? adapter.getServiceClient() : supabase;
  const { error: uploadError } = await serviceClient.storage.from("product-images").upload(storagePath, buffer, {
    contentType: "image/webp",
    upsert: false,
  });

  if (uploadError) {
    adapter.logServerError?.("admin.saveProductImage", "storage_upload_failed");
    return adapter.redirect("/admin/catalog?error=product_image_upload_failed");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: rpcError } = await (supabase.rpc as any)("admin_save_product_image", {
    p_product_id: productId,
    p_storage_path: storagePath,
    p_alt_text: altText,
    p_variant_id: variantId,
    p_position: position,
  });

  if (rpcError) {
    adapter.logServerError?.("admin.saveProductImage", "rpc_error");
    await serviceClient.storage.from("product-images").remove([storagePath]);
    return adapter.redirect("/admin/catalog?error=save_product_image_failed");
  }

  adapter.revalidatePath?.("/admin/catalog");
  adapter.revalidatePath?.("/products");
  return adapter.redirect("/admin/catalog?notice=product_image_saved");
}

export async function executeDeleteProductImage(
  formData: FormData,
  adapter: CatalogActionAdapter
): Promise<never> {
  await adapter.requireAdminAal2("/admin/catalog");

  const parsedImageId = parseRequiredUuid(formData.get("image_id"));
  if (!parsedImageId.valid) {
    return adapter.redirect("/admin/catalog?error=invalid_product_image");
  }
  const imageId = parsedImageId.value!;

  const serviceClient = adapter.getServiceClient ? adapter.getServiceClient() : await adapter.getSupabase();
  const { data: image, error: imgErr } = await serviceClient
    .from("product_images")
    .select("storage_path")
    .eq("id", imageId)
    .maybeSingle();

  if (imgErr || !image) {
    return adapter.redirect("/admin/catalog?error=product_image_not_found");
  }

  const supabase = await adapter.getSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.rpc as any)("admin_delete_product_image", { p_image_id: imageId });
  if (error) {
    adapter.logServerError?.("admin.deleteProductImage", "rpc_error");
    return adapter.redirect("/admin/catalog?error=delete_product_image_failed");
  }

  await serviceClient.storage.from("product-images").remove([image.storage_path]);
  adapter.revalidatePath?.("/admin/catalog");
  adapter.revalidatePath?.("/products");
  return adapter.redirect("/admin/catalog?notice=product_image_deleted");
}

export async function executeAdjustInventory(
  formData: FormData,
  adapter: CatalogActionAdapter
): Promise<never> {
  await adapter.requireAdminAal2("/admin/catalog");

  const parsedVariantId = parseRequiredUuid(formData.get("variant_id"));
  if (!parsedVariantId.valid) {
    return adapter.redirect("/admin/catalog?error=invalid_variant_id");
  }
  const variantId = parsedVariantId.value!;

  const rawDelta = formData.get("delta");
  if (typeof rawDelta !== "string") {
    return adapter.redirect("/admin/catalog?error=missing_inventory_fields");
  }
  const delta = parseInt(rawDelta.trim(), 10);
  if (isNaN(delta) || delta === 0) {
    return adapter.redirect("/admin/catalog?error=invalid_delta");
  }

  const rawType = formData.get("type");
  const type = typeof rawType === "string" && ["adjustment", "restock"].includes(rawType.trim())
    ? rawType.trim()
    : "adjustment";

  const rawReason = formData.get("reason");
  if (typeof rawReason !== "string" || !rawReason.trim()) {
    return adapter.redirect("/admin/catalog?error=missing_inventory_fields");
  }
  const reason = rawReason.trim();

  const idempotencyKey = `inv_adj_${variantId}_${Date.now()}_${randomUUID().replace(/-/g, "")}`;
  const supabase = await adapter.getSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.rpc as any)("admin_adjust_inventory", {
    p_variant_id: variantId,
    p_delta: delta,
    p_type: type,
    p_reason: reason,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    adapter.logServerError?.("admin.adjustInventory", "rpc_error");
    return adapter.redirect("/admin/catalog?error=adjust_inventory_failed");
  }

  adapter.revalidatePath?.("/admin/catalog");
  return adapter.redirect("/admin/catalog?notice=inventory_adjusted");
}
