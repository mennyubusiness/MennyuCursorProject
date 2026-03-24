/**
 * PATCH: update order-level admin resolution notes (shared, not per-issue).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminApiRequestAuthorized } from "@/lib/admin-auth";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ orderId: string }> }
) {
  if (!(await isAdminApiRequestAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { orderId } = await context.params;
  if (!orderId?.trim()) {
    return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
  }

  let body: { notes?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const notes =
    typeof body.notes === "string" ? body.notes.trim() || null : body.notes === null ? null : undefined;
  if (notes === undefined) {
    return NextResponse.json({ error: "Provide notes: string | null" }, { status: 400 });
  }

  try {
    await prisma.order.update({
      where: { id: orderId.trim() },
      data: { adminResolutionNotes: notes },
    });
  } catch {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
