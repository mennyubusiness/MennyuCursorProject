/**
 * POST: Admin QA — simulate Deliverect routing failure without calling Deliverect.
 * Platform admin only; disabled in production unless ENABLE_ADMIN_TEST_TOOLS=true.
 */
import { NextResponse } from "next/server";
import { assertAdminTestToolsApiAccess } from "@/lib/admin-test-tools";
import { simulateVendorOrderRoutingFailure } from "@/services/admin-simulate-routing-failure.service";

export async function POST(
  _request: Request,
  context: { params: Promise<{ vendorOrderId: string }> }
) {
  const gate = await assertAdminTestToolsApiAccess();
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false, error: gate.error, code: gate.code },
      { status: gate.status }
    );
  }

  const { vendorOrderId } = await context.params;
  if (!vendorOrderId?.trim()) {
    return NextResponse.json(
      { ok: false, error: "Missing vendorOrderId", code: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  const result = await simulateVendorOrderRoutingFailure(vendorOrderId);
  if (!result.ok) {
    const status =
      result.code === "NOT_FOUND" ? 404 : result.code === "ORDER_UNPAID" ? 409 : 400;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result);
}
