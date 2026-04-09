"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { authorizeVendorSettingsWrite } from "@/lib/server/vendor-settings-authorization";
import { deleteSupabasePublicObjectIfInBucket } from "@/lib/supabase/storage-cleanup";
import { timingSafeStringEqual } from "@/lib/vendor-dashboard-auth";
import { setVendorDashboardSessionCookie } from "@/lib/vendor-dashboard-session";
import {
  normalizeVendorDescription,
  normalizeVendorDisplayName,
  normalizeVendorLogoUrl,
  parseSafeHexAccentColor,
} from "@/lib/vendor-brand";

async function revalidateVendorCustomerSurfaces(vendorId: string) {
  const id = vendorId.trim();
  revalidatePath(`/vendor/${id}`);
  revalidatePath(`/vendor/${id}/settings`);
  revalidatePath(`/vendor/${id}/menu`);
  const pods = await prisma.podVendor.findMany({
    where: { vendorId: id },
    select: { podId: true },
  });
  for (const { podId } of pods) {
    revalidatePath(`/pod/${podId}`);
    revalidatePath(`/pod/${podId}/vendor/${id}`);
  }
}

export type VendorBrandProfileInput = {
  name: string;
  description: string;
  imageUrl: string;
  accentColor: string;
};

export async function updateVendorBrandProfile(
  vendorId: string,
  input: VendorBrandProfileInput
): Promise<{ ok: boolean; error?: string }> {
  const authz = await authorizeVendorSettingsWrite(vendorId);
  if (!authz.ok) return authz;

  const nameResult = normalizeVendorDisplayName(input.name);
  if (!nameResult.ok) return { ok: false, error: nameResult.error };

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

  const vid = vendorId.trim();
  const previous = await prisma.vendor.findUnique({
    where: { id: vid },
    select: { imageUrl: true },
  });

  await prisma.vendor.update({
    where: { id: vid },
    data: {
      name: nameResult.value,
      description,
      imageUrl: logoUrl,
      accentColor,
    },
  });

  if (previous?.imageUrl && previous.imageUrl !== logoUrl) {
    void deleteSupabasePublicObjectIfInBucket(previous.imageUrl);
  }

  await revalidateVendorCustomerSurfaces(vendorId);
  return { ok: true };
}

export async function bindVendorDashboardSession(
  vendorId: string,
  tokenPlain: string
): Promise<{ ok: boolean; error?: string }> {
  const v = await prisma.vendor.findUnique({
    where: { id: vendorId.trim() },
    select: { vendorDashboardToken: true },
  });
  if (!v?.vendorDashboardToken?.trim()) {
    return {
      ok: false,
      error: "No API access key is configured for this vendor yet. Ask your Mennyu administrator to generate one.",
    };
  }
  if (!timingSafeStringEqual(tokenPlain.trim(), v.vendorDashboardToken.trim())) {
    return { ok: false, error: "API access key does not match." };
  }

  await setVendorDashboardSessionCookie(vendorId, tokenPlain.trim());

  revalidatePath(`/vendor/${vendorId}`);
  revalidatePath(`/vendor/${vendorId}/settings`);
  revalidatePath(`/vendor/${vendorId}/menu`);
  revalidatePath(`/vendor/${vendorId}/menu-imports`);
  return { ok: true };
}

export async function updateVendorAutoPublishMenus(
  vendorId: string,
  autoPublishMenus: boolean
): Promise<{ ok: boolean; error?: string }> {
  const authz = await authorizeVendorSettingsWrite(vendorId);
  if (!authz.ok) return authz;

  await prisma.vendor.update({
    where: { id: vendorId.trim() },
    data: { autoPublishMenus },
  });

  revalidatePath(`/vendor/${vendorId.trim()}/settings`);
  return { ok: true };
}
