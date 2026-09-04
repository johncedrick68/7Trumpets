import { deleteAddress, getCustomerAddresses, saveAddress, setDefaultAddress } from "@/lib/addresses/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AccountNavigation } from "@/components/account-navigation";

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
    <main className="w-full min-h-screen px-4 py-8 md:py-12 max-w-5xl mx-auto">
      <div className="w-full">
        <header className="mb-8">
          <p className="text-xs font-mono font-bold tracking-widest text-muted-foreground uppercase">
            Customer Account
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight mt-1 mb-1">
            Shipping Addresses
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage delivery locations for rapid checkout.
          </p>
        </header>

        <AccountNavigation current="addresses" />

        {params.saved === "1" && (
          <div className="p-4 text-sm text-green-800 bg-green-50 rounded-md border border-green-200 mb-6" role="status">
            Address saved successfully.
          </div>
        )}
        {params.updated === "1" && (
          <div className="p-4 text-sm text-green-800 bg-green-50 rounded-md border border-green-200 mb-6" role="status">
            Default delivery address updated.
          </div>
        )}
        {params.deleted === "1" && (
          <div className="p-4 text-sm text-green-800 bg-green-50 rounded-md border border-green-200 mb-6" role="status">
            Address deleted.
          </div>
        )}
        {params.error === "missing_fields" && (
          <div className="p-4 text-sm text-red-800 bg-red-50 rounded-md border border-red-200 mb-6" role="alert">
            Please fill in all required address fields.
          </div>
        )}
        {params.error === "save_failed" && (
          <div className="p-4 text-sm text-red-800 bg-red-50 rounded-md border border-red-200 mb-6" role="alert">
            Failed to save address. Please check your details and try again.
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Saved Addresses List */}
          <section aria-labelledby="saved-addr-title">
            <h2 id="saved-addr-title" className="text-xl font-bold mb-4 pb-2 border-b border-border">
              Your Saved Addresses ({addresses.length})
            </h2>

            {addresses.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No saved addresses yet. Add your primary shipping address using the form.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {addresses.map((addr) => (
                  <Card key={addr.id} className="border-border shadow-sm">
                    <CardContent className="p-5">
                      <div className="flex justify-between items-center mb-3">
                        <strong className="text-base">{addr.label || addr.recipient_name}</strong>
                        {addr.is_default && (
                          <Badge variant="default" className="text-[10px] uppercase tracking-wider px-2">Default</Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground leading-relaxed mb-4">
                        <strong className="text-foreground">{addr.recipient_name}</strong> ({addr.phone})<br />
                        {addr.address_line1}
                        {addr.address_line2 && <>, {addr.address_line2}</>}
                        {addr.barangay && <>, Brgy. {addr.barangay}</>}<br />
                        {addr.city_municipality}, {addr.province} {addr.postal_code}
                      </div>

                      <div className="flex items-center gap-3 pt-4 border-t border-border">
                        {!addr.is_default && (
                          <form action={setDefaultAddress}>
                            <input type="hidden" name="address_id" value={addr.id} />
                            <Button type="submit" variant="outline" size="sm">
                              Set as Default
                            </Button>
                          </form>
                        )}
                        <form action={deleteAddress}>
                          <input type="hidden" name="address_id" value={addr.id} />
                          <Button type="submit" variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                            Delete
                          </Button>
                        </form>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* Add New Address Form */}
          <Card className="shadow-sm border-border" aria-labelledby="add-addr-title">
            <CardHeader className="pb-4 border-b border-border mb-4">
              <CardTitle id="add-addr-title" className="text-xl">Add New Address</CardTitle>
            </CardHeader>

            <form action={saveAddress}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="label">Address Label (e.g. Home, Office)</Label>
                  <Input id="label" name="label" placeholder="Home" maxLength={50} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="recipient_name">Recipient Name *</Label>
                  <Input id="recipient_name" name="recipient_name" required maxLength={100} placeholder="Juan Dela Cruz" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input id="phone" name="phone" type="tel" required maxLength={32} placeholder="0917 123 4567" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address_line1">Street Address / House No. *</Label>
                  <Input id="address_line1" name="address_line1" required maxLength={255} placeholder="123 Katipunan St." />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address_line2">Apartment / Unit (Optional)</Label>
                  <Input id="address_line2" name="address_line2" maxLength={255} placeholder="Unit 4B" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="barangay">Barangay (Optional)</Label>
                  <Input id="barangay" name="barangay" maxLength={100} placeholder="Brgy. San Roque" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city_municipality">City / Municipality *</Label>
                    <Input id="city_municipality" name="city_municipality" required maxLength={100} placeholder="Quezon City" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="province">Province *</Label>
                    <Input id="province" name="province" required maxLength={100} placeholder="Metro Manila" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="postal_code">Postal / Zip Code *</Label>
                  <Input id="postal_code" name="postal_code" required maxLength={16} placeholder="1100" />
                </div>

                <div className="flex items-center gap-2 mt-4 pt-2">
                  <input id="is_default" name="is_default" type="checkbox" className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                  <Label htmlFor="is_default" className="font-normal cursor-pointer">Set as default shipping address</Label>
                </div>
              </CardContent>

              <CardFooter className="pt-4 border-t border-border mt-4">
                <Button type="submit" className="w-full">
                  Save Shipping Address &rarr;
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    </main>
  );
}
