import "server-only";

import { prisma } from "@/lib/db";

export type VendorPendingPodInviteView = {
  id: string;
  podId: string;
  podName: string;
  status: string;
  createdAt: string;
  invitedEmail: string | null;
};

export type VendorPendingPodInvitesContext = {
  requests: VendorPendingPodInviteView[];
  currentPod: { id: string; name: string } | null;
  hasPodMembership: boolean;
};

/** Pending pod membership requests for vendor-facing invite UI. */
export async function loadVendorPendingPodInvites(
  vendorId: string
): Promise<VendorPendingPodInvitesContext> {
  const [requests, currentPod, vendor] = await Promise.all([
    prisma.podMembershipRequest.findMany({
      where: { vendorId, status: "pending" },
      include: { pod: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.podVendor.findFirst({
      where: { vendorId },
      include: { pod: { select: { id: true, name: true } } },
    }),
    prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { contactEmail: true },
    }),
  ]);

  const requestIds = requests.map((r) => r.id);
  const invites =
    requestIds.length > 0
      ? await prisma.podVendorInvite.findMany({
          where: {
            OR: [
              { membershipRequestId: { in: requestIds } },
              { targetVendorId: vendorId, status: "pending" },
            ],
          },
          select: {
            membershipRequestId: true,
            podId: true,
            invitedEmail: true,
          },
        })
      : [];

  const emailByRequestId = new Map<string, string>();
  const emailByPodId = new Map<string, string>();
  for (const invite of invites) {
    if (invite.membershipRequestId) {
      emailByRequestId.set(invite.membershipRequestId, invite.invitedEmail);
    }
    emailByPodId.set(invite.podId, invite.invitedEmail);
  }

  return {
    requests: requests.map((r) => ({
      id: r.id,
      podId: r.pod.id,
      podName: r.pod.name,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      invitedEmail:
        emailByRequestId.get(r.id) ?? emailByPodId.get(r.podId) ?? vendor?.contactEmail ?? null,
    })),
    currentPod: currentPod ? { id: currentPod.pod.id, name: currentPod.pod.name } : null,
    hasPodMembership: Boolean(currentPod),
  };
}
