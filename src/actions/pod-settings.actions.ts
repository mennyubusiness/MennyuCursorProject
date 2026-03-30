"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { isAdminDashboardLayoutAuthorized } from "@/lib/admin-auth";
import {
  normalizeVendorDescription,
  normalizeVendorDisplayName,
  normalizeVendorLogoUrl,
  parseSafeHexAccentColor,
} from "@/lib/vendor-brand";

async function authorizePodSettingsWrite(): Promise<{ ok: true } | { ok: false; error: string }> {
  const allowed = await isAdminDashboardLayoutAuthorized();
  if (!allowed) {
    return { ok: false, error: "Unauthorized." };
  }
  return { ok: true };
}

export type PodBrandProfileInput = {
  name: string;
  description: string;
  imageUrl: string;
  accentColor: string;
};

export async function updatePodBrandProfile(
  podId: string,
  input: PodBrandProfileInput
): Promise<{ ok: boolean; error?: string }> {
  const authz = await authorizePodSettingsWrite();
  if (!authz.ok) return authz;

  const id = podId.trim();
  const pod = await prisma.pod.findUnique({ where: { id }, select: { id: true } });
  if (!pod) return { ok: false, error: "Pod not found." };

  const nameResult = normalizeVendorDisplayName(input.name);
  if (!nameResult.ok) {
    return { ok: false, error: nameResult.error.replaceAll("Business name", "Pod name") };
  }

  const descRaw = input.description?.trim() ?? "";
  if (descRaw.length > 2000) {
    return { ok: false, error: "Description must be at most 2000 characters." };
  }
  const description = normalizeVendorDescription(descRaw);

  const logoUrl = normalizeVendorLogoUrl(input.imageUrl);
  if (input.imageUrl?.trim() && !logoUrl) {
    return {
      ok: false,
      error: "Logo must be a valid https:// image URL, or leave blank to clear.",
    };
  }

  const accentRaw = input.accentColor?.trim() ?? "";
  const accentColor = accentRaw ? parseSafeHexAccentColor(accentRaw) : null;
  if (accentRaw && !accentColor) {
    return {
      ok: false,
      error: "Accent color must be a hex value like #1d4ed8 (six digits after #).",
    };
  }

  await prisma.pod.update({
    where: { id },
    data: {
      name: nameResult.value,
      description,
      imageUrl: logoUrl,
      accentColor,
    },
  });

  revalidatePath(`/pod/${id}`);
  revalidatePath(`/pod/${id}/settings`);
  revalidatePath("/explore");
  return { ok: true };
}

export type PodVendorPresentationRow = {
  vendorId: string;
  isFeatured: boolean;
};

/**
 * Rows are top-to-bottom display order. Featured vendors are shown first on the customer pod page,
 * in this order among featured, then non-featured in this order among non-featured.
 */
export async function updatePodVendorPresentation(
  podId: string,
  rows: PodVendorPresentationRow[]
): Promise<{ ok: boolean; error?: string }> {
  const authz = await authorizePodSettingsWrite();
  if (!authz.ok) return authz;

  const id = podId.trim();
  const pod = await prisma.pod.findUnique({ where: { id }, select: { id: true } });
  if (!pod) return { ok: false, error: "Pod not found." };

  const existing = await prisma.podVendor.findMany({
    where: { podId: id },
    select: { vendorId: true },
  });
  const idSet = new Set(existing.map((e) => e.vendorId));
  if (rows.length !== idSet.size) {
    return { ok: false, error: "Vendor list must include every vendor in this pod." };
  }
  const seen = new Set<string>();
  for (const r of rows) {
    if (!idSet.has(r.vendorId) || seen.has(r.vendorId)) {
      return { ok: false, error: "Invalid or duplicate vendor in list." };
    }
    seen.add(r.vendorId);
  }

  const featured = rows.filter((r) => r.isFeatured);
  const other = rows.filter((r) => !r.isFeatured);

  await prisma.$transaction([
    ...featured.map((r, i) =>
      prisma.podVendor.update({
        where: { podId_vendorId: { podId: id, vendorId: r.vendorId } },
        data: { isFeatured: true, sortOrder: i },
      })
    ),
    ...other.map((r, i) =>
      prisma.podVendor.update({
        where: { podId_vendorId: { podId: id, vendorId: r.vendorId } },
        data: { isFeatured: false, sortOrder: i },
      })
    ),
  ]);

  revalidatePath(`/pod/${id}`);
  revalidatePath(`/pod/${id}/settings`);
  for (const r of rows) {
    revalidatePath(`/pod/${id}/vendor/${r.vendorId}`);
  }
  return { ok: true };
}
