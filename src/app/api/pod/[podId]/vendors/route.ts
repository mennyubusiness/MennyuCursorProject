/**
 * POST: request to add a vendor to the pod.
 * Access: platform admin or PodMembership for podId.
 *
 * Interim product rule: one pod per vendor; no direct add/move without vendor approval.
 * - Already in this pod → 200 ok (idempotent).
 * - In another pod → 400 (moves require vendor approval).
 * - In no pod → 400 (join requires request/accept workflow, not yet built).
 * We do NOT create PodVendor here until a vendor-approved join flow exists.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertPodApiAccess } from "@/lib/permissions";

export async function POST(
  request: Request,
  context: { params: Promise<{ podId: string }> }
) {
  const { podId } = await context.params;
  if (!podId) {
    return NextResponse.json({ error: "Missing podId" }, { status: 400 });
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
  const vendorId =
    body && typeof body === "object" && "vendorId" in body && typeof (body as { vendorId: unknown }).vendorId === "string"
      ? (body as { vendorId: string }).vendorId
      : null;
  if (!vendorId) {
    return NextResponse.json({ error: "Missing vendorId in body" }, { status: 400 });
  }

  const pod = await prisma.pod.findUnique({ where: { id: podId }, select: { id: true } });
  if (!pod) {
    return NextResponse.json({ error: "Pod not found" }, { status: 404 });
  }
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true } });
  if (!vendor) {
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  }

  // One pod per vendor: find any existing membership for this vendor
  const existingMembership = await prisma.podVendor.findFirst({
    where: { vendorId },
    select: { podId: true },
  });

  if (existingMembership) {
    if (existingMembership.podId === podId) {
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json(
      {
        error:
          "This vendor is already assigned to another pod. Pod changes require vendor approval.",
      },
      { status: 400 }
    );
  }

  // Unassigned vendor: direct add not allowed until request/accept workflow exists
  return NextResponse.json(
    {
      error:
        "Vendor join requires a request/accept workflow (coming soon). You can remove vendors from this pod below.",
    },
    { status: 400 }
  );
}
