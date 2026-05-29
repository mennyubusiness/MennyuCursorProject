/**
 * PATCH body: { isActive: boolean }
 * Updates Vendor.isActive. No schema change; uses existing field.
 */
import { NextResponse } from "next/server";
import { isAdminApiRequestAuthorized } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ vendorId: string }> }
) {
  if (!(await isAdminApiRequestAuthorized(request))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { vendorId } = await context.params;
  if (!vendorId) {
    return NextResponse.json({ error: "Missing vendorId" }, { status: 400 });
  }

  let body: { isActive?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body.isActive !== "boolean") {
    return NextResponse.json({ error: "isActive must be boolean" }, { status: 400 });
  }

  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) {
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  }

  await prisma.vendor.update({
    where: { id: vendorId },
    data: { isActive: body.isActive },
  });

  return NextResponse.json({ ok: true, isActive: body.isActive });
}
