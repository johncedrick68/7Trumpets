import Link from "next/link";
import { deleteAddress, getCustomerAddresses, saveAddress, setDefaultAddress } from "@/lib/addresses/actions";

export const dynamic = "force-dynamic";

export default async function AddressesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; updated?: string; deleted?: string }>;
}) {
  const [addresses, params] = await Promise.all([
    getCustomerAddresses(),
    searchParams,
  ]);

  return (
    <main className="catalog-main">
      <div className="catalog-container" style={{ maxWidth: "860px" }}>
        <header style={{ marginBottom: "1.75rem" }}>
          <p className="eyebrow">Customer Account</p>
          <h1 style={{ fontSize: "2rem", fontWeight: 800, margin: "0 0 0.25rem", letterSpacing: "-0.02em" }}>
            Shipping Addresses
          </h1>
          <p style={{ color: "var(--ink-secondary)", fontSize: "14px", margin: 0 }}>
            Manage delivery locations for rapid checkout.
          </p>
        </header>

        {/* Account Sub-Navigation Tabs */}
        <nav className="account-tabs" aria-label="Account navigation">
          <Link href="/account" className="account-tab">
            Profile Settings
          </Link>
          <Link href="/orders" className="account-tab">
            Order History
          </Link>
          <Link href="/account/addresses" className="account-tab active">
            Saved Addresses
          </Link>
          <Link href="/update-password" className="account-tab">
            Password &amp; Security
          </Link>
          <Link href="/cart" className="account-tab">
            Shopping Bag
          </Link>
        </nav>

        {params.saved === "1" && (
          <p className="notice" role="status">Address saved successfully.</p>
        )}
        {params.updated === "1" && (
          <p className="notice" role="status">Default delivery address updated.</p>
        )}
        {params.deleted === "1" && (
          <p className="notice" role="status">Address deleted.</p>
        )}
        {params.error === "missing_fields" && (
          <p className="error" role="alert">Please fill in all required address fields.</p>
        )}
        {params.error === "save_failed" && (
          <p className="error" role="alert">Failed to save address. Please check your details and try again.</p>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "2rem", alignItems: "start" }}>
          {/* Saved Addresses List */}
          <section className="card-surface" aria-labelledby="saved-addr-title">
            <h2 id="saved-addr-title" style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 1rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.75rem" }}>
              Your Saved Addresses ({addresses.length})
            </h2>

            {addresses.length === 0 ? (
              <p style={{ color: "var(--ink-muted)", fontSize: "13px", padding: "1rem 0" }}>
                No saved addresses yet. Add your primary shipping address using the form.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {addresses.map((addr) => (
                  <article key={addr.id} style={{ padding: "1.25rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                      <strong>{addr.label || addr.recipient_name}</strong>
                      {addr.is_default && (
                        <span className="status-pill status-confirmed">Default</span>
                      )}
                    </div>
                    <p style={{ fontSize: "13px", color: "var(--ink-secondary)", lineHeight: 1.6, margin: "0 0 1rem" }}>
                      <strong>{addr.recipient_name}</strong> ({addr.phone})<br />
                      {addr.address_line1}
                      {addr.address_line2 && <>, {addr.address_line2}</>}
                      {addr.barangay && <>, Brgy. {addr.barangay}</>}<br />
                      {addr.city_municipality}, {addr.province} {addr.postal_code}
                    </p>

                    <div style={{ display: "flex", gap: "0.5rem", borderTop: "1px solid var(--border)", paddingTop: "0.75rem" }}>
                      {!addr.is_default && (
                        <form action={setDefaultAddress}>
                          <input type="hidden" name="address_id" value={addr.id} />
                          <button type="submit" className="btn btn-secondary small-btn">
                            Set as Default
                          </button>
                        </form>
                      )}
                      <form action={deleteAddress}>
                        <input type="hidden" name="address_id" value={addr.id} />
                        <button type="submit" className="btn btn-secondary small-btn" style={{ color: "var(--danger)" }}>
                          Delete
                        </button>
                      </form>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* Add New Address Form */}
          <section className="card-surface" aria-labelledby="add-addr-title">
            <h2 id="add-addr-title" style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 1rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.75rem" }}>
              Add New Address
            </h2>

            <form action={saveAddress}>
              <div className="form-group">
                <label htmlFor="label">Address Label (e.g. Home, Office)</label>
                <input id="label" name="label" placeholder="Home" maxLength={50} />
              </div>

              <div className="form-group">
                <label htmlFor="recipient_name">Recipient Name *</label>
                <input id="recipient_name" name="recipient_name" required maxLength={100} placeholder="Juan Dela Cruz" />
              </div>

              <div className="form-group">
                <label htmlFor="phone">Phone Number *</label>
                <input id="phone" name="phone" type="tel" required maxLength={32} placeholder="0917 123 4567" />
              </div>

              <div className="form-group">
                <label htmlFor="address_line1">Street Address / House No. *</label>
                <input id="address_line1" name="address_line1" required maxLength={255} placeholder="123 Katipunan St." />
              </div>

              <div className="form-group">
                <label htmlFor="address_line2">Apartment / Unit (Optional)</label>
                <input id="address_line2" name="address_line2" maxLength={255} placeholder="Unit 4B" />
              </div>

              <div className="form-group">
                <label htmlFor="barangay">Barangay (Optional)</label>
                <input id="barangay" name="barangay" maxLength={100} placeholder="Brgy. San Roque" />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div className="form-group">
                  <label htmlFor="city_municipality">City / Municipality *</label>
                  <input id="city_municipality" name="city_municipality" required maxLength={100} placeholder="Quezon City" />
                </div>
                <div className="form-group">
                  <label htmlFor="province">Province *</label>
                  <input id="province" name="province" required maxLength={100} placeholder="Metro Manila" />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="postal_code">Postal / Zip Code *</label>
                <input id="postal_code" name="postal_code" required maxLength={16} placeholder="1100" />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: "0.5rem 0 1rem" }}>
                <input id="is_default" name="is_default" type="checkbox" style={{ width: "auto", minHeight: "auto" }} />
                <label htmlFor="is_default" style={{ margin: 0, fontSize: "13px", color: "var(--ink)" }}>Set as default shipping address</label>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}>
                Save Shipping Address &rarr;
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
