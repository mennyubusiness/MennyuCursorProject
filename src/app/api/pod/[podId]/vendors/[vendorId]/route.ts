/**
 * DELETE: remove a vendor from the pod (delete PodVendor only; vendor record is unchanged).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertPodApiAccess } from "@/lib/permissions";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ podId: string; vendorId: string }> }
) {
  const { podId, vendorId } = await context.params;
  if (!podId || !vendorId) {
    return NextResponse.json({ error: "Missing podId or vendorId" }, { status: 400 });
  }

  const gate = await assertPodApiAccess(request, podId);
  if (!gate.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: gate.status });
  }

  const deleted = await prisma.podVendor.deleteMany({
    where: { podId, vendorId },
  });

  if (deleted.count === 0) {
    return NextResponse.json({ error: "Vendor was not in this pod" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
