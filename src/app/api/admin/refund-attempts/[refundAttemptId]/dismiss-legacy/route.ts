/**
 * POST: Mark a failed RefundAttempt as dismissed as legacy/test.
 * Removes it from the Needs Attention queue; audit trail is preserved (dismissedAsLegacyAt/By).
 * Only allowed for status === "failed". Does not change refund execution logic.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  _request: Request,
  context: { params: Promise<{ refundAttemptId: string }> }
) {
  const { refundAttemptId } = await context.params;
  if (!refundAttemptId) {
    return NextResponse.json({ error: "Missing refundAttemptId" }, { status: 400 });
  }

  const ra = await prisma.refundAttempt.findUnique({
    where: { id: refundAttemptId },
    select: { id: true, status: true, dismissedAsLegacyAt: true },
  });
  if (!ra) {
    return NextResponse.json({ error: "Refund attempt not found" }, { status: 404 });
  }
  if (ra.status !== "failed") {
    return NextResponse.json(
      { error: "Only failed refund attempts can be dismissed as legacy" },
      { status: 400 }
    );
  }
  if (ra.dismissedAsLegacyAt != null) {
    return NextResponse.json({ ok: true, message: "Already dismissed" });
  }

  await prisma.refundAttempt.update({
    where: { id: refundAttemptId },
    data: {
      dismissedAsLegacyAt: new Date(),
      dismissedAsLegacyBy: "admin",
    },
  });

  return NextResponse.json({ ok: true, message: "Dismissed as legacy/test" });
}
