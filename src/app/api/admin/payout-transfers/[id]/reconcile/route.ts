import { NextResponse } from "next/server";
import { isAdminApiRequestAuthorized } from "@/lib/admin-auth";
import { reconcileVendorPayoutTransfer } from "@/services/vendor-payout-transfer-reconciliation.service";

export const dynamic = "force-dynamic";

/** POST: reconcile one vendor payout transfer row against Stripe (read-only; never creates transfers). */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminApiRequestAuthorized(_request))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ ok: false, error: "Missing transfer id" }, { status: 400 });
  }

  const result = await reconcileVendorPayoutTransfer(id);
  return NextResponse.json({ ok: true, result });
}
