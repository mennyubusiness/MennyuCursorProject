/**
 * PATCH: pause or reactivate a vendor in this pod (`PodVendor.isActive`).
 * DELETE: remove a vendor from the pod (delete PodVendor only; vendor record is unchanged).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertPodApiAccess } from "@/lib/permissions";

export async function PATCH(
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("isActive" in body) ||
    typeof (body as { isActive: unknown }).isActive !== "boolean"
  ) {
    return NextResponse.json({ error: "Body must include boolean isActive" }, { status: 400 });
  }

  const isActive = (body as { isActive: boolean }).isActive;

  const updated = await prisma.podVendor.updateMany({
    where: { podId, vendorId },
    data: { isActive },
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: "Vendor was not in this pod" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, isActive });
}

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
