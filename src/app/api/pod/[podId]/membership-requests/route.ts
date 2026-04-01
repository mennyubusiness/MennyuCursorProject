/**
 * Pod membership requests: create and list.
 * Access: platform admin or PodMembership for podId.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertPodApiAccess } from "@/lib/permissions";

const PENDING = "pending";

export async function GET(
  request: Request,
  context: { params: Promise<{ podId: string }> }
) {
  const { podId } = await context.params;
  if (!podId) return NextResponse.json({ error: "Missing podId" }, { status: 400 });

  const gate = await assertPodApiAccess(request, podId);
  if (!gate.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: gate.status });
  }

  const pod = await prisma.pod.findUnique({
    where: { id: podId },
    select: { id: true },
  });
  if (!pod) return NextResponse.json({ error: "Pod not found" }, { status: 404 });

  const requests = await prisma.podMembershipRequest.findMany({
    where: { podId, status: PENDING },
    include: {
      vendor: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    requests: requests.map((r) => ({
      id: r.id,
      vendorId: r.vendorId,
      vendorName: r.vendor.name,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ podId: string }> }
) {
  const { podId } = await context.params;
  if (!podId) return NextResponse.json({ error: "Missing podId" }, { status: 400 });

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
  if (!vendorId) return NextResponse.json({ error: "Missing vendorId in body" }, { status: 400 });

  const pod = await prisma.pod.findUnique({ where: { id: podId }, select: { id: true, name: true } });
  if (!pod) return NextResponse.json({ error: "Pod not found" }, { status: 404 });
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true } });
  if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

  const alreadyInPod = await prisma.podVendor.findUnique({
    where: { podId_vendorId: { podId, vendorId } },
  });
  if (alreadyInPod) {
    return NextResponse.json(
      { error: "This vendor is already in your pod." },
      { status: 400 }
    );
  }

  const existingPending = await prisma.podMembershipRequest.findFirst({
    where: { podId, vendorId, status: PENDING },
  });
  if (existingPending) {
    return NextResponse.json(
      { error: "A pending request for this vendor already exists. Awaiting vendor approval." },
      { status: 400 }
    );
  }

  const req = await prisma.podMembershipRequest.create({
    data: { podId, vendorId, status: PENDING },
    include: { vendor: { select: { name: true } } },
  });

  return NextResponse.json({
    id: req.id,
    podId: req.podId,
    vendorId: req.vendorId,
    vendorName: req.vendor.name,
    status: req.status,
    createdAt: req.createdAt.toISOString(),
  });
}
