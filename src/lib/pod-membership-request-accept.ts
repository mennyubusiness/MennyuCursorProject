import { prisma } from "@/lib/db";

const PENDING = "pending";
const ACCEPTED = "accepted";
const CANCELLED = "cancelled";

export type AcceptPodMembershipResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

/**
 * Completes a pending pod membership request (vendor joins pod).
 * Shared by vendor-side and pod-side accept APIs.
 */
export async function acceptPodMembershipRequest(requestId: string): Promise<AcceptPodMembershipResult> {
  const req = await prisma.podMembershipRequest.findUnique({
    where: { id: requestId },
    include: { pod: { select: { id: true, name: true } } },
  });
  if (!req) return { ok: false, status: 404, error: "Request not found" };
  if (req.status !== PENDING) {
    return { ok: false, status: 400, error: "This request has already been responded to." };
  }

  const now = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.podVendor.findFirst({
        where: { vendorId: req.vendorId },
        select: { podId: true },
      });

      if (existing) {
        if (existing.podId === req.podId) {
          await tx.podMembershipRequest.update({
            where: { id: requestId },
            data: { status: ACCEPTED, respondedAt: now, updatedAt: now },
          });
          return;
        }
        await tx.podVendor.deleteMany({ where: { vendorId: req.vendorId } });
      }

      const maxRow = await tx.podVendor.aggregate({
        where: { podId: req.podId },
        _max: { sortOrder: true },
      });
      const nextSort = (maxRow._max.sortOrder ?? -1) + 1;

      await tx.podVendor.create({
        data: { podId: req.podId, vendorId: req.vendorId, sortOrder: nextSort },
      });
      await tx.podMembershipRequest.update({
        where: { id: requestId },
        data: { status: ACCEPTED, respondedAt: now, updatedAt: now },
      });

      await tx.podMembershipRequest.updateMany({
        where: { vendorId: req.vendorId, id: { not: requestId }, status: PENDING },
        data: { status: CANCELLED, updatedAt: now },
      });
    });
  } catch (e) {
    console.error("[acceptPodMembershipRequest]", e);
    return { ok: false, status: 500, error: "Could not complete request." };
  }

  return { ok: true };
}
