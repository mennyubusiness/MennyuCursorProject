/**
 * POST: Admin QA — simulate Deliverect order status webhook (no outbound Deliverect call).
 * Platform admin only; disabled in production unless ENABLE_ADMIN_TEST_TOOLS=true.
 */
import { NextResponse } from "next/server";
import { assertAdminTestToolsApiAccess } from "@/lib/admin-test-tools";
import { simulateVendorOrderDeliverectStatus } from "@/services/admin-simulate-deliverect-status.service";

export async function POST(
  request: Request,
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

  let body: { statusCode?: number; note?: string };
  try {
    body = (await request.json()) as { statusCode?: number; note?: string };
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body", code: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  const statusCode = body.statusCode;
  if (typeof statusCode !== "number" || !Number.isFinite(statusCode)) {
    return NextResponse.json(
      { ok: false, error: "statusCode is required", code: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  const result = await simulateVendorOrderDeliverectStatus(
    vendorOrderId,
    Math.trunc(statusCode),
    typeof body.note === "string" ? body.note : undefined
  );

  if (!result.ok) {
    const status =
      result.code === "NOT_FOUND"
        ? 404
        : result.code === "ORDER_UNPAID" || result.code === "TERMINAL_FULFILLMENT"
          ? 409
          : 400;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result);
}
