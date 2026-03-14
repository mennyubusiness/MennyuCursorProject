/**
 * List pod membership requests for this vendor.
 * Vendor can only see requests where vendorId matches (URL param).
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const PENDING = "pending";

export async function GET(
  _request: Request,
  context: { params: Promise<{ vendorId: string }> }
) {
  const { vendorId } = await context.params;
  if (!vendorId) return NextResponse.json({ error: "Missing vendorId" }, { status: 400 });

  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { id: true },
  });
  if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

  const requests = await prisma.podMembershipRequest.findMany({
    where: { vendorId, status: PENDING },
    include: {
      pod: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const currentPod = await prisma.podVendor.findFirst({
    where: { vendorId },
    include: { pod: { select: { id: true, name: true } } },
  });

  return NextResponse.json({
    requests: requests.map((r) => ({
      id: r.id,
      podId: r.pod.id,
      podName: r.pod.name,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
    currentPod: currentPod
      ? { id: currentPod.pod.id, name: currentPod.pod.name }
      : null,
  });
}
