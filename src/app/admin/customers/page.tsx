import { requireAdminAal2 } from "@/lib/admin/auth";
import { listCustomers, getCustomerGrowthMetrics } from "@/lib/customers/queries";
import { CustomersWorkspace } from "@/components/admin/customers-workspace";

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage() {
  await requireAdminAal2("/admin/customers");

  const [customers, metrics] = await Promise.all([
    listCustomers(),
    getCustomerGrowthMetrics(),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight mb-1">Customer Growth & Directory</h1>
        <p className="text-xs text-muted-foreground max-w-2xl">
          Track customer acquisition, lifetime spend, order velocity, and individual customer profiles.
        </p>
      </header>

      <CustomersWorkspace customers={customers} metrics={metrics} />
    </div>
  );
}
