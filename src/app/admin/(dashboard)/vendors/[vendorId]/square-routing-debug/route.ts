import { NextResponse } from "next/server";
import { isAdminDashboardLayoutAuthorized } from "@/lib/admin-auth";
import { loadAdminSquareOrderInjectionDiagnostics } from "@/lib/integrations/square/admin-square-order-injection-diagnostics.server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ vendorId: string }> }
) {
  if (!(await isAdminDashboardLayoutAuthorized())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { vendorId } = await context.params;
  const id = vendorId?.trim();
  if (!id) {
    return NextResponse.json({ error: "Missing vendorId" }, { status: 400 });
  }

  const diagnostics = await loadAdminSquareOrderInjectionDiagnostics(id);
  if (!diagnostics) {
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  }

  return NextResponse.json(diagnostics);
}
