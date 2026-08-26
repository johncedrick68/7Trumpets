import { redirect } from "next/navigation";

import {
  adjustInventory, deleteProductImage, saveCategory, saveOptionValue, saveProduct,
  saveProductImage, saveProductOption, saveVariant, setVariantOptionValue,
} from "@/lib/admin/actions";
import { getAdminAuthContext } from "@/lib/admin/auth";
import { formatMinorUnitsToPHP } from "@/lib/catalog/queries";
import { logServerError } from "@/lib/server-log";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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
    .select("id, name, slug, position, archived_at")
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
    <div className="admin-page">
      <header className="admin-page-header">
        <h1>Catalog & Inventory Management</h1>
        <p className="subtle-text">Operational management of categories, products, variants, and stock levels.</p>
      </header>

      {notice && <div className="notice-banner" style={{ background: "#e6fffa", color: "#234e52", padding: "0.75rem 1rem", borderRadius: "4px", marginBottom: "1rem" }}>Action successful: {notice}</div>}
      {error && <div className="error-banner" style={{ background: "#fff5f5", color: "#9b2c2c", padding: "0.75rem 1rem", borderRadius: "4px", marginBottom: "1rem" }}>Error: {error}</div>}

      {/* Grid: Forms for creation */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.5rem", marginBottom: "2rem" }}>
        {/* Category Form */}
        <div className="admin-card">
          <h3>Create Category</h3>
          <form action={saveCategory} style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.75rem" }}>
            <div>
              <label className="small-text" style={{ display: "block" }}>Name</label>
              <input type="text" name="name" required placeholder="e.g. Graphic Tees" className="admin-input" style={{ width: "100%", padding: "0.5rem" }} />
            </div>
            <div>
              <label className="small-text" style={{ display: "block" }}>Slug</label>
              <input type="text" name="slug" required placeholder="e.g. graphic-tees" className="admin-input" style={{ width: "100%", padding: "0.5rem" }} />
            </div>
            <div>
              <label className="small-text" style={{ display: "block" }}>Description</label>
              <textarea name="description" placeholder="Category details" className="admin-input" style={{ width: "100%", padding: "0.5rem" }} />
            </div>
            <button type="submit" className="button button-primary" style={{ marginTop: "0.5rem" }}>Save Category</button>
          </form>
        </div>

        {/* Product Form */}
        <div className="admin-card">
          <h3>Create Product</h3>
          <form action={saveProduct} style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.75rem" }}>
            <div>
              <label className="small-text" style={{ display: "block" }}>Category</label>
              <select name="category_id" className="admin-input" style={{ width: "100%", padding: "0.5rem" }}>
                <option value="">(No Category)</option>
                {categoryList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="small-text" style={{ display: "block" }}>Product Title</label>
              <input type="text" name="name" required placeholder="e.g. Kingdom Oversized Tee" className="admin-input" style={{ width: "100%", padding: "0.5rem" }} />
            </div>
            <div>
              <label className="small-text" style={{ display: "block" }}>Slug</label>
              <input type="text" name="slug" required placeholder="e.g. kingdom-oversized-tee" className="admin-input" style={{ width: "100%", padding: "0.5rem" }} />
            </div>
            <div>
              <label className="small-text" style={{ display: "block" }}>Status</label>
              <select name="status" className="admin-input" style={{ width: "100%", padding: "0.5rem" }}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <button type="submit" className="button button-primary" style={{ marginTop: "0.5rem" }}>Save Product</button>
          </form>
        </div>

        {/* Variant & Stock Form */}
        <div className="admin-card">
          <h3>Create Variant & Stock</h3>
          <form action={saveVariant} style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.75rem" }}>
            <div>
              <label className="small-text" style={{ display: "block" }}>Product</label>
              <select name="product_id" required className="admin-input" style={{ width: "100%", padding: "0.5rem" }}>
                {productList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="small-text" style={{ display: "block" }}>SKU</label>
              <input type="text" name="sku" required placeholder="e.g. TEE-BLK-M" className="admin-input" style={{ width: "100%", padding: "0.5rem" }} />
            </div>
            <div>
              <label className="small-text" style={{ display: "block" }}>Variant Name</label>
              <input type="text" name="name" placeholder="e.g. Black / Medium" className="admin-input" style={{ width: "100%", padding: "0.5rem" }} />
            </div>
            <div>
              <label className="small-text" style={{ display: "block" }}>Price (PHP)</label>
              <input type="number" step="0.01" min="0" name="price" required placeholder="e.g. 599.00" className="admin-input" style={{ width: "100%", padding: "0.5rem" }} />
            </div>
            <button type="submit" className="button button-primary" style={{ marginTop: "0.5rem" }}>Save Variant</button>
          </form>
        </div>

        <div className="admin-card">
          <h3>Create Product Option</h3>
          <form action={saveProductOption} style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.75rem" }}>
            <label>Product
              <select name="product_id" required className="admin-input">
                {productList.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
              </select>
            </label>
            <label>Option name<input name="name" required placeholder="e.g. Color" className="admin-input" /></label>
            <label>Position<input name="position" type="number" defaultValue="0" className="admin-input" /></label>
            <button type="submit" className="button button-primary">Save Option</button>
          </form>
        </div>

        <div className="admin-card">
          <h3>Upload Product Image</h3>
          <form action={saveProductImage} style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.75rem" }}>
            <label>Product
              <select name="product_id" required className="admin-input">
                {productList.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
              </select>
            </label>
            <label>Variant (optional)
              <select name="variant_id" className="admin-input">
                <option value="">All variants</option>
                {productList.flatMap((product) => product.product_variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>{product.name}: {variant.name || variant.sku}</option>
                )))}
              </select>
            </label>
            <label>WebP image<input name="image" type="file" accept="image/webp" required className="admin-input" /></label>
            <label>Alternative text<input name="alt_text" required className="admin-input" /></label>
            <label>Position<input name="position" type="number" defaultValue="0" className="admin-input" /></label>
            <button type="submit" className="button button-primary">Upload Image</button>
          </form>
        </div>
      </div>

      {/* Existing Products & Variants Table */}
      <div className="admin-card">
        <h2>Active Catalog & Inventory ({productList.length})</h2>

        {productList.length === 0 ? (
          <p className="subtle-text" style={{ padding: "1.5rem 0" }}>
            No products found in catalog.
          </p>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Status</th>
                  <th>Variants, Pricing & Stock Adjustments</th>
                </tr>
              </thead>
              <tbody>
                {productList.map((product) => (
                  <tr key={product.id}>
                    <td style={{ verticalAlign: "top" }}>
                      <strong>{product.name}</strong>
                      <div className="subtle-text small-text">slug: {product.slug}</div>
                      {product.product_images.sort((a, b) => a.position - b.position).map((image) => (
                        <form key={image.id} action={deleteProductImage} style={{ marginTop: "0.5rem" }}>
                          <input type="hidden" name="image_id" value={image.id} />
                          <span className="small-text">Image {image.position}: {image.alt_text}</span>{" "}
                          <button type="submit" className="button button-secondary small-btn">Delete</button>
                        </form>
                      ))}
                    </td>
                    <td style={{ verticalAlign: "top" }}>
                      <span className={`status-pill status-${product.status}`}>
                        {product.status}
                      </span>
                    </td>
                    <td>
                      {product.product_variants.length === 0 ? (
                        <span className="subtle-text small-text">No variants</span>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                          {product.product_variants.map((variant) => {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const inv = (variant.inventory as any)?.[0];
                            const available = inv ? inv.on_hand - inv.reserved : 0;

                            return (
                              <div key={variant.id} style={{ border: "1px solid var(--border)", padding: "0.5rem", borderRadius: "4px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                                  <strong>{variant.name || variant.sku}</strong> ({variant.sku}):{" "}
                                  <span>{formatMinorUnitsToPHP(variant.price_minor)}</span>
                                </div>
                                <div className="small-text subtle-text" style={{ marginBottom: "0.5rem" }}>
                                  Stock: <strong>{available}</strong> available ({inv?.on_hand ?? 0} on hand, {inv?.reserved ?? 0} reserved)
                                </div>
                                {/* Fast Stock Adjustment Form */}
                                 <form action={adjustInventory} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                                  <input type="hidden" name="variant_id" value={variant.id} />
                                  <input type="hidden" name="type" value="adjustment" />
                                  <input type="number" name="delta" required placeholder="± qty" style={{ width: "70px", padding: "0.25rem" }} />
                                  <input type="text" name="reason" required placeholder="Reason for change" style={{ flex: 1, padding: "0.25rem" }} />
                                  <button type="submit" className="button button-secondary" style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}>Adjust Stock</button>
                                 </form>
                                 {product.product_options.sort((a, b) => a.position - b.position).map((option) => {
                                   const assigned = variant.variant_option_values.find((value) => value.option_id === option.id);
                                   return (
                                     <form key={option.id} action={setVariantOptionValue} style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", alignItems: "center" }}>
                                       <input type="hidden" name="product_id" value={product.id} />
                                       <input type="hidden" name="variant_id" value={variant.id} />
                                       <input type="hidden" name="option_id" value={option.id} />
                                       <label className="small-text" htmlFor={`${variant.id}-${option.id}`}>{option.name}</label>
                                       <select id={`${variant.id}-${option.id}`} name="option_value_id" defaultValue={assigned?.option_value_id} required>
                                         <option value="">Select value</option>
                                         {option.product_option_values.sort((a, b) => a.position - b.position).map((value) => (
                                           <option key={value.id} value={value.id}>{value.value}</option>
                                         ))}
                                       </select>
                                       <button type="submit" className="button button-secondary small-btn">Assign</button>
                                     </form>
                                   );
                                 })}
                               </div>
                            );
                          })}
                        </div>
                      )}
                      {product.product_options.map((option) => (
                        <form key={option.id} action={saveOptionValue} style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", alignItems: "center" }}>
                          <input type="hidden" name="product_id" value={product.id} />
                          <input type="hidden" name="option_id" value={option.id} />
                          <label className="small-text">Add {option.name}<input name="value" required placeholder="Value" /></label>
                          <input name="position" type="number" defaultValue={option.product_option_values.length} aria-label={`${option.name} position`} style={{ width: "4rem" }} />
                          <button type="submit" className="button button-secondary small-btn">Add</button>
                        </form>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
