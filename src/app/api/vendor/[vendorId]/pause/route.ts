/**
 * PATCH /api/vendor/[vendorId]/pause
 * Body: { paused: boolean }
 * Toggles Mennyu order intake for this vendor. Does not affect POS or existing in-progress orders.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  _request: Request,
  context: { params: Promise<{ vendorId: string }> }
) {
  const { vendorId } = await context.params;
  if (!vendorId) {
    return NextResponse.json({ error: "Missing vendorId" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await _request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const obj = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  const paused = typeof obj?.paused === "boolean" ? obj.paused : null;

  if (paused === null) {
    return NextResponse.json(
      { error: "Missing or invalid body: { paused: boolean }" },
      { status: 400 }
    );
  }

  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { id: true },
  });
  if (!vendor) {
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  }

  await prisma.vendor.update({
    where: { id: vendorId },
    data: { mennyuOrdersPaused: paused },
  });

  return NextResponse.json({ paused });
}
