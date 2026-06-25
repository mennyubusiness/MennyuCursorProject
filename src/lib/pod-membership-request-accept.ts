import { attachVendorToPod } from "@/lib/attach-vendor-to-pod";
import { prisma } from "@/lib/db";

const PENDING = "pending";

export type AcceptPodMembershipResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

/**
 * Completes a pending pod membership request (vendor joins pod).
 * Shared by vendor-side accept API and admin-only pod-side accept API.
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

  const attach = await attachVendorToPod(req.podId, req.vendorId);
  if (!attach.ok) {
    return { ok: false, status: 500, error: attach.error };
  }

  return { ok: true };
}
