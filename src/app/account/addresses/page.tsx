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
      <div className="catalog-container">
        <nav aria-label="Breadcrumb" className="breadcrumb">
          <Link href="/account">Account</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Saved Addresses</span>
        </nav>

        <header className="catalog-header">
          <p className="eyebrow">Customer Account</p>
          <h1>Shipping Addresses</h1>
          <p className="summary">Manage your delivery addresses for seamless checkout.</p>
        </header>

        {params.saved === "1" && (
          <p className="notice" role="status">Address saved successfully.</p>
        )}
        {params.updated === "1" && (
          <p className="notice" role="status">Default address updated.</p>
        )}
        {params.deleted === "1" && (
          <p className="notice" role="status">Address removed.</p>
        )}
        {params.error === "missing_fields" && (
          <p className="error" role="alert">Please fill in all required address fields.</p>
        )}
        {params.error === "save_failed" && (
          <p className="error" role="alert">Failed to save address. Please check your details and try again.</p>
        )}

        <div className="address-layout">
          <section className="address-list-section" aria-labelledby="saved-addr-title">
            <h2 id="saved-addr-title">Your Addresses</h2>
            {addresses.length === 0 ? (
              <p className="catalog-empty-text">No addresses saved yet. Add one below.</p>
            ) : (
              <div className="address-grid">
                {addresses.map((addr) => (
                  <article key={addr.id} className={`address-card ${addr.is_default ? "default-card" : ""}`}>
                    {addr.is_default && (
                      <span className="default-badge">Default Address</span>
                    )}
                    {addr.label && <h3 className="address-label">{addr.label}</h3>}
                    <p className="address-name">{addr.recipient_name}</p>
                    <p className="address-phone">{addr.phone}</p>
                    <p className="address-lines">
                      {addr.address_line1}
                      {addr.address_line2 && <>, {addr.address_line2}</>}
                      {addr.barangay && <>, Brgy. {addr.barangay}</>}
                      <br />
                      {addr.city_municipality}, {addr.province} {addr.postal_code}
                    </p>

                    <div className="address-card-actions">
                      {!addr.is_default && (
                        <form action={setDefaultAddress}>
                          <input type="hidden" name="address_id" value={addr.id} />
                          <button type="submit" className="button-link secondary small-btn">
                            Set as Default
                          </button>
                        </form>
                      )}
                      <form action={deleteAddress}>
                        <input type="hidden" name="address_id" value={addr.id} />
                        <button type="submit" className="remove-item-btn">
                          Delete
                        </button>
                      </form>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="address-form-section" aria-labelledby="add-addr-title">
            <h2 id="add-addr-title">Add New Address</h2>
            <form action={saveAddress} className="address-form">
              <label htmlFor="label">Address Label (e.g., Home, Work)</label>
              <input id="label" name="label" placeholder="Home" maxLength={50} />

              <label htmlFor="recipient_name">Recipient Name *</label>
              <input id="recipient_name" name="recipient_name" required maxLength={100} />

              <label htmlFor="phone">Phone Number *</label>
              <input id="phone" name="phone" type="tel" required maxLength={32} />

              <label htmlFor="address_line1">Street Address *</label>
              <input id="address_line1" name="address_line1" required maxLength={255} />

              <label htmlFor="address_line2">Apartment / Suite / Unit (Optional)</label>
              <input id="address_line2" name="address_line2" maxLength={255} />

              <label htmlFor="barangay">Barangay (Optional)</label>
              <input id="barangay" name="barangay" maxLength={100} />

              <label htmlFor="city_municipality">City / Municipality *</label>
              <input id="city_municipality" name="city_municipality" required maxLength={100} />

              <label htmlFor="province">Province *</label>
              <input id="province" name="province" required maxLength={100} />

              <label htmlFor="postal_code">Postal Code *</label>
              <input id="postal_code" name="postal_code" required maxLength={16} />

              <div className="checkbox-row">
                <input id="is_default" name="is_default" type="checkbox" />
                <label htmlFor="is_default">Set as default shipping address</label>
              </div>

              <button type="submit" className="button-link">Save Address</button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
