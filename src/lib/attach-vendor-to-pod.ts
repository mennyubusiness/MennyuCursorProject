import { prisma } from "@/lib/db";

const PENDING = "pending";
const ACCEPTED = "accepted";
const CANCELLED = "cancelled";

export type AttachVendorToPodResult =
  | { ok: true; alreadyAttached: boolean; previousPodId: string | null }
  | { ok: false; error: string };

/**
 * Attaches a vendor to a pod (creates PodVendor, cancels other pending requests).
 * Idempotent when the vendor is already in the target pod.
 */
export async function attachVendorToPod(podId: string, vendorId: string): Promise<AttachVendorToPodResult> {
  const now = new Date();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.podVendor.findFirst({
        where: { vendorId },
        select: { podId: true },
      });

      let previousPodId: string | null = null;

      if (existing) {
        if (existing.podId === podId) {
          await tx.podMembershipRequest.updateMany({
            where: { podId, vendorId, status: PENDING },
            data: { status: ACCEPTED, respondedAt: now, updatedAt: now },
          });
          return { alreadyAttached: true, previousPodId: null };
        }
        previousPodId = existing.podId;
        await tx.podVendor.deleteMany({ where: { vendorId } });
      }

      const maxRow = await tx.podVendor.aggregate({
        where: { podId },
        _max: { sortOrder: true },
      });
      const nextSort = (maxRow._max.sortOrder ?? -1) + 1;

      await tx.podVendor.create({
        data: { podId, vendorId, sortOrder: nextSort, isActive: true },
      });

      await tx.podMembershipRequest.updateMany({
        where: { podId, vendorId, status: PENDING },
        data: { status: ACCEPTED, respondedAt: now, updatedAt: now },
      });

      await tx.podMembershipRequest.updateMany({
        where: { vendorId, podId: { not: podId }, status: PENDING },
        data: { status: CANCELLED, updatedAt: now },
      });

      return { alreadyAttached: false, previousPodId };
    });

    return {
      ok: true,
      alreadyAttached: result.alreadyAttached,
      previousPodId: result.previousPodId,
    };
  } catch (e) {
    console.error("[attachVendorToPod]", e);
    return { ok: false, error: "Could not attach vendor to pod." };
  }
}
