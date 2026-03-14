/**
 * DELETE: remove a vendor from the pod (delete PodVendor only; vendor record is unchanged).
 * Requires same access as pod dashboard (caller is trusted by layout guard).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ podId: string; vendorId: string }> }
) {
  const { podId, vendorId } = await context.params;
  if (!podId || !vendorId) {
    return NextResponse.json({ error: "Missing podId or vendorId" }, { status: 400 });
  }

  const deleted = await prisma.podVendor.deleteMany({
    where: { podId, vendorId },
  });

  if (deleted.count === 0) {
    return NextResponse.json({ error: "Vendor was not in this pod" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
