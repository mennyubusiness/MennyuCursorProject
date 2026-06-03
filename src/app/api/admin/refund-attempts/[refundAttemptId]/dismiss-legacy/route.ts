/**
 * POST: Mark a stale/orphaned RefundAttempt as dismissed legacy.
 * Preserves audit trail (dismissedAsLegacyAt/By). Verifies Stripe when configured.
 */
import { NextResponse } from "next/server";
import { isAdminApiRequestAuthorized } from "@/lib/admin-auth";
import {
  dismissStaleRefundAttempt,
  StaleRefundAttemptError,
} from "@/services/stale-refund-attempt.service";

export async function POST(
  request: Request,
  context: { params: Promise<{ refundAttemptId: string }> }
) {
  if (!(await isAdminApiRequestAuthorized(request))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { refundAttemptId } = await context.params;
  if (!refundAttemptId) {
    return NextResponse.json({ error: "Missing refundAttemptId" }, { status: 400 });
  }

  try {
    const result = await dismissStaleRefundAttempt({
      refundAttemptId,
      dismissedBy: "admin",
    });
    return NextResponse.json({
      ok: true,
      message: result.alreadyDismissed
        ? "Already dismissed"
        : "Dismissed stale refund attempt",
      refundAttemptId: result.refundAttemptId,
      alreadyDismissed: result.alreadyDismissed,
    });
  } catch (e) {
    if (e instanceof StaleRefundAttemptError) {
      const status =
        e.code === "NOT_FOUND" ? 404 : e.code === "STRIPE_VERIFY_FAILED" ? 409 : 400;
      return NextResponse.json({ ok: false, code: e.code, error: e.message }, { status });
    }
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
