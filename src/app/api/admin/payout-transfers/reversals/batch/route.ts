import { NextResponse } from "next/server";
import { isAdminApiRequestAuthorized } from "@/lib/admin-auth";
import { runPendingTransferReversalBatch } from "@/services/vendor-payout-transfer-reversal.service";

export const dynamic = "force-dynamic";

/** Manual batch: process pending Stripe transfer reversals (one API call per row). */
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

  const summary = await runPendingTransferReversalBatch(batchKey ? { batchKey } : undefined);
  return NextResponse.json(summary);
}
