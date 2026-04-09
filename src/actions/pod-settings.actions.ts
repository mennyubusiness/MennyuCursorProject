"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { canAccessPodDashboardLayout } from "@/lib/permissions";
import { deleteSupabasePublicObjectIfInBucket } from "@/lib/supabase/storage-cleanup";
import {
  normalizeVendorDescription,
  normalizeVendorDisplayName,
  normalizeVendorLogoUrl,
  parseSafeHexAccentColor,
} from "@/lib/vendor-brand";

async function authorizePodSettingsWrite(
  podId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const allowed = await canAccessPodDashboardLayout(podId.trim());
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
  const id = podId.trim();
  const authz = await authorizePodSettingsWrite(id);
  if (!authz.ok) return authz;

  const pod = await prisma.pod.findUnique({ where: { id }, select: { id: true, imageUrl: true } });
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

  if (pod.imageUrl && pod.imageUrl !== logoUrl) {
    void deleteSupabasePublicObjectIfInBucket(pod.imageUrl);
  }

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
 * Rows are top-to-bottom customer display order. sortOrder is set to 0..n-1 in that order.
 * isFeatured is independent (badge only; does not change ordering).
 */
export async function updatePodVendorPresentation(
  podId: string,
  rows: PodVendorPresentationRow[]
): Promise<{ ok: boolean; error?: string }> {
  const id = podId.trim();
  const authz = await authorizePodSettingsWrite(id);
  if (!authz.ok) return authz;

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

  await prisma.$transaction(
    rows.map((r, index) =>
      prisma.podVendor.update({
        where: { podId_vendorId: { podId: id, vendorId: r.vendorId } },
        data: { isFeatured: r.isFeatured, sortOrder: index },
      })
    )
  );

  revalidatePath(`/pod/${id}`);
  revalidatePath(`/pod/${id}/settings`);
  revalidatePath(`/pod/${id}/dashboard`);
  for (const r of rows) {
    revalidatePath(`/pod/${id}/vendor/${r.vendorId}`);
  }
  return { ok: true };
}
