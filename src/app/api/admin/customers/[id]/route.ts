import { NextRequest, NextResponse } from "next/server";
import { getCustomerDetail } from "@/lib/customers/queries";
import { requireAdminAal2 } from "@/lib/admin/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminAal2("/admin/customers");
    const { id } = await params;
    const detail = await getCustomerDetail(id);

    if (!detail) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch {
    return NextResponse.json({ error: "Unauthorized or failed" }, { status: 401 });
  }
}
