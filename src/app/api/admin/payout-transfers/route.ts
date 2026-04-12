import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminApiRequestAuthorized } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/** Recent vendor payout transfer rows (admin / dev tooling). */
export async function GET(request: Request) {
  if (!(await isAdminApiRequestAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await prisma.vendorPayoutTransfer.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      paymentAllocationId: true,
      vendorOrderId: true,
      vendorId: true,
      destinationAccountId: true,
      amountCents: true,
      currency: true,
      status: true,
      blockedReason: true,
      stripeTransferId: true,
      idempotencyKey: true,
      batchKey: true,
      failureMessage: true,
      submittedAt: true,
      failedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ transfers: rows });
}
