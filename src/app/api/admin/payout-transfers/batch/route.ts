import { NextResponse } from "next/server";
import { isAdminApiRequestAuthorized } from "@/lib/admin-auth";
import { runManualVendorPayoutTransferBatch } from "@/services/vendor-payout-transfer.service";

export const dynamic = "force-dynamic";

/** Manual batch: process all pending (non-blocked) vendor payout transfers. */
export async function POST(request: Request) {
  if (!(await isAdminApiRequestAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let batchKey: string | undefined;
  try {
    const body = (await request.json()) as { batchKey?: string };
    if (typeof body.batchKey === "string" && body.batchKey.trim()) {
      batchKey = body.batchKey.trim();
    }
  } catch {
    // empty body
  }

  const result = await runManualVendorPayoutTransferBatch(batchKey ? { batchKey } : undefined);
  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error,
        balanceError: result.balanceError,
        summary: result.summary,
      },
      { status: 503 }
    );
  }
  return NextResponse.json(result.summary);
}
