import { NextResponse } from "next/server";
import { isAdminApiRequestAuthorized } from "@/lib/admin-auth";
import { reconcileEligibleVendorPayoutTransfers } from "@/services/vendor-payout-transfer-reconciliation.service";

export const dynamic = "force-dynamic";

/** POST: bulk reconcile eligible vendor payout transfers (max 100 per run). */
export async function POST(request: Request) {
  if (!(await isAdminApiRequestAuthorized(request))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let limit: number | undefined;
  try {
    const body = (await request.json()) as { limit?: number };
    if (typeof body.limit === "number" && Number.isFinite(body.limit)) {
      limit = body.limit;
    }
  } catch {
    // empty body
  }

  const summary = await reconcileEligibleVendorPayoutTransfers({ limit });
  return NextResponse.json({ ok: true, summary });
}
