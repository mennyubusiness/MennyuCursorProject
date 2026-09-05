import "server-only";

import { AccountOnboardingStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { ADMIN_AUDIT_ACTION, ADMIN_AUDIT_TARGET, requireAdminReason } from "@/lib/admin-audit-log";
import { buildPodCustomerPath } from "@/lib/customer-public-url";
import { prisma } from "@/lib/db";
import { uniquePodSlugFromName } from "@/lib/slug-server";
import { createAdminAuditLog } from "@/services/admin-audit-log.service";

export type AdminCreateUnclaimedPodResult =
  | {
      ok: true;
      pod: { id: string; name: string; slug: string };
      message: string;
    }
  | {
      ok: false;
      error: string;
      duplicateWarning?: { podId: string; podName: string; address: string | null };
    };

function normalizedText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

export async function adminCreateUnclaimedPod(input: {
  name: string;
  address?: string | null;
  ownerContactName?: string | null;
  contactEmail?: string | null;
  description?: string | null;
  adminUserId: string | null;
  reason: string;
  allowDuplicate?: boolean;
}): Promise<AdminCreateUnclaimedPodResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;

  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length < 2) return { ok: false, error: "Pod name is required." };
  if (name.length > 160) return { ok: false, error: "Pod name is too long." };

  const address = input.address?.trim().replace(/\s+/g, " ") || null;
  const contactEmail = input.contactEmail?.trim().toLowerCase() || null;
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return { ok: false, error: "Enter a valid contact email." };
  }

  const sameNamePods = await prisma.pod.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, address: true },
    take: 500,
  });
  const duplicate = sameNamePods.find((pod) => {
    if (normalizedText(pod.name) !== normalizedText(name)) return false;
    if (!address || !pod.address) return true;
    return normalizedText(pod.address) === normalizedText(address);
  });
  if (duplicate && !input.allowDuplicate) {
    return {
      ok: false,
      error: `${duplicate.name} already exists${
        duplicate.address ? ` at ${duplicate.address}` : ""
      }. Confirm this is a separate location.`,
      duplicateWarning: {
        podId: duplicate.id,
        podName: duplicate.name,
        address: duplicate.address,
      },
    };
  }

  const slug = await uniquePodSlugFromName(name);
  const pod = await prisma.pod.create({
    data: {
      name,
      slug,
      address,
      ownerContactName: input.ownerContactName?.trim() || null,
      contactEmail,
      description: input.description?.trim() || null,
      orderingEnabled: false,
      onboardingStatus: AccountOnboardingStatus.ready_for_next_step,
    },
    select: { id: true, name: true, slug: true },
  });

  await createAdminAuditLog({
    adminUserId: input.adminUserId,
    actionType: ADMIN_AUDIT_ACTION.UNCLAIMED_POD_CREATED,
    targetType: ADMIN_AUDIT_TARGET.pod,
    targetId: pod.id,
    reason: reasonCheck.reason,
    newValue: {
      podId: pod.id,
      orderingEnabled: false,
      ownerMembershipCount: 0,
    },
    metadata: {
      invitedEmail: contactEmail,
      address,
    },
  });

  revalidatePath("/admin/pods");
  revalidatePath(`/admin/pods/${pod.id}`);
  revalidatePath(buildPodCustomerPath(pod.slug));
  revalidatePath("/explore");

  return {
    ok: true,
    pod,
    message: `${pod.name} created as an unclaimed, menu-only pod.`,
  };
}
