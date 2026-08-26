import { redirect } from "next/navigation";

import { getAdminAuthContext } from "@/lib/admin/auth";
import { formatMinorUnitsToPHP } from "@/lib/catalog/queries";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminCatalogOverviewPage() {
  const adminCtx = await getAdminAuthContext();
  if (!adminCtx) {
    redirect("/login?next=/admin/catalog");
  }

  const serviceClient = createServiceClient();

  // Fetch products with variants and inventory status
  const { data: products } = await serviceClient
    .from("products")
    .select(`
      id,
      name,
      slug,
      status,
      created_at,
      product_variants (
        id,
        sku,
        name,
        price_minor,
        status,
        inventory (
          on_hand,
          reserved,
          safety_stock
        )
      )
    `)
    .order("created_at", { ascending: false });

  const productList = products || [];

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <h1>Catalog & Inventory Overview</h1>
        <p className="subtle-text">Read-only operational view of published catalog items and active inventory.</p>
      </header>

      <div className="admin-card">
        <h2>Products & Variants ({productList.length})</h2>

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
                  <th>Variants & Stock</th>
                </tr>
              </thead>
              <tbody>
                {productList.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <strong>{product.name}</strong>
                      <div className="subtle-text small-text">slug: {product.slug}</div>
                    </td>
                    <td>
                      <span className={`status-pill status-${product.status}`}>
                        {product.status}
                      </span>
                    </td>
                    <td>
                      {product.product_variants.length === 0 ? (
                        <span className="subtle-text small-text">No variants</span>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                          {product.product_variants.map((variant) => {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const inv = (variant.inventory as any)?.[0];
                            const available = inv ? inv.on_hand - inv.reserved : 0;

                            return (
                              <div key={variant.id} className="small-text" style={{ borderBottom: "1px dashed var(--border)", paddingBottom: "0.25rem" }}>
                                <strong>{variant.name || variant.sku}</strong> ({variant.sku}):{" "}
                                <span>{formatMinorUnitsToPHP(variant.price_minor)}</span> |{" "}
                                <span>Stock: <strong>{available}</strong> avail ({inv?.on_hand ?? 0} on hand, {inv?.reserved ?? 0} res)</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
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
