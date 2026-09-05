import "server-only";

import { AccountOnboardingStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { ADMIN_AUDIT_ACTION, ADMIN_AUDIT_TARGET, requireAdminReason } from "@/lib/admin-audit-log";
import { prisma } from "@/lib/db";
import { revalidateVendorPodMembershipSurfaces } from "@/lib/revalidate-vendor-pod-surfaces.server";
import { uniqueVendorSlugFromName } from "@/lib/slug-server";
import { createAdminAuditLog } from "@/services/admin-audit-log.service";

export type AdminCreateUnclaimedVendorResult =
  | {
      ok: true;
      vendor: { id: string; name: string; slug: string; podId: string };
      message: string;
    }
  | {
      ok: false;
      error: string;
      duplicateWarning?: { vendorId: string; vendorName: string };
    };

function normalizedBusinessName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

export async function adminCreateUnclaimedVendor(input: {
  podId: string;
  name: string;
  cuisineCategory?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  adminUserId: string | null;
  reason: string;
  allowDuplicateName?: boolean;
}): Promise<AdminCreateUnclaimedVendorResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;

  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length < 2) return { ok: false, error: "Vendor name is required." };
  if (name.length > 160) return { ok: false, error: "Vendor name is too long." };

  const contactEmail = input.contactEmail?.trim().toLowerCase() || null;
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return { ok: false, error: "Enter a valid contact email." };
  }

  const pod = await prisma.pod.findUnique({
    where: { id: input.podId },
    select: {
      id: true,
      name: true,
      vendors: { select: { vendor: { select: { id: true, name: true } } } },
    },
  });
  if (!pod) return { ok: false, error: "Pod not found." };

  const duplicate = pod.vendors
    .map((row) => row.vendor)
    .find((vendor) => normalizedBusinessName(vendor.name) === normalizedBusinessName(name));
  if (duplicate && !input.allowDuplicateName) {
    return {
      ok: false,
      error: `${duplicate.name} is already in this pod. Confirm if these are separate businesses.`,
      duplicateWarning: { vendorId: duplicate.id, vendorName: duplicate.name },
    };
  }

  const slug = await uniqueVendorSlugFromName(name);
  const vendor = await prisma.$transaction(async (tx) => {
    const maxRow = await tx.podVendor.aggregate({
      where: { podId: pod.id },
      _max: { sortOrder: true },
    });
    const created = await tx.vendor.create({
      data: {
        name,
        slug,
        cuisineCategory: input.cuisineCategory?.trim() || null,
        contactName: input.contactName?.trim() || null,
        contactEmail,
        orderingEnabled: false,
        onboardingStatus: AccountOnboardingStatus.ready_for_next_step,
      },
      select: { id: true, name: true, slug: true },
    });
    await tx.podVendor.create({
      data: {
        podId: pod.id,
        vendorId: created.id,
        sortOrder: (maxRow._max.sortOrder ?? -1) + 1,
        isActive: true,
      },
    });
    return created;
  });

  await createAdminAuditLog({
    adminUserId: input.adminUserId,
    actionType: ADMIN_AUDIT_ACTION.UNCLAIMED_VENDOR_CREATED,
    targetType: ADMIN_AUDIT_TARGET.vendor,
    targetId: vendor.id,
    reason: reasonCheck.reason,
    newValue: {
      vendorId: vendor.id,
      podId: pod.id,
      orderingEnabled: false,
      ownerMembershipCount: 0,
    },
    metadata: {
      podId: pod.id,
      podName: pod.name,
      invitedEmail: contactEmail,
    },
  });

  await revalidateVendorPodMembershipSurfaces({ vendorId: vendor.id, podIds: [pod.id] });
  revalidatePath("/admin/vendors");
  revalidatePath(`/admin/pods/${pod.id}`);

  return {
    ok: true,
    vendor: { ...vendor, podId: pod.id },
    message: `${vendor.name} created as an unclaimed, menu-only vendor.`,
  };
}
