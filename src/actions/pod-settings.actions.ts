"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { buildPodCustomerPath, buildVendorMenuCustomerPath } from "@/lib/customer-public-url";
import { prisma } from "@/lib/db";
import { canAccessPodDashboardLayout } from "@/lib/permissions";
import { deleteSupabasePublicObjectIfInBucket } from "@/lib/supabase/storage-cleanup";
import { normalizePodAmenitiesInput, normalizePodCustomAmenitiesInput } from "@/lib/pod-amenities";
import {
  normalizeVendorDescription,
  normalizeVendorDisplayName,
  normalizeVendorLogoUrl,
  parseSafeHexAccentColor,
} from "@/lib/vendor-brand";

function normalizeOptionalText(raw: string | undefined | null, maxLen: number): string | null {
  const t = raw?.trim() ?? "";
  if (!t) return null;
  if (t.length > maxLen) return null;
  return t;
}

function normalizeOptionalHttpsUrl(raw: string | undefined | null): string | null {
  const t = raw?.trim() ?? "";
  if (!t) return null;
  try {
    const url = new URL(t.startsWith("http://") || t.startsWith("https://") ? t : `https://${t}`);
    if (url.protocol !== "https:") return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function normalizeInstagramUrl(raw: string | undefined | null): string | null {
  const t = raw?.trim() ?? "";
  if (!t) return null;
  if (t.startsWith("@")) {
    const handle = t.slice(1).replace(/\/$/, "");
    if (!handle || handle.length > 80) return null;
    return `https://instagram.com/${handle}`;
  }
  return normalizeOptionalHttpsUrl(t);
}

function normalizeOptionalEmail(raw: string | undefined | null): string | null {
  const t = raw?.trim() ?? "";
  if (!t) return null;
  if (t.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return null;
  return t.toLowerCase();
}

function normalizeOptionalPhone(raw: string | undefined | null): string | null {
  const t = raw?.trim() ?? "";
  if (!t) return null;
  if (t.length > 40) return null;
  return t;
}

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
  tagline: string;
  description: string;
  imageUrl: string;
  accentColor: string;
  address: string;
  contactEmail: string;
  contactPhone: string;
  websiteUrl: string;
  instagramUrl: string;
  pickupInstructions: string;
  amenities: string[];
  customAmenities: string;
};

export async function updatePodBrandProfile(
  podId: string,
  input: PodBrandProfileInput
): Promise<{ ok: boolean; error?: string }> {
  const id = podId.trim();
  const authz = await authorizePodSettingsWrite(id);
  if (!authz.ok) return authz;

  const pod = await prisma.pod.findUnique({ where: { id }, select: { id: true, slug: true, imageUrl: true } });
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

  const taglineRaw = input.tagline?.trim() ?? "";
  if (taglineRaw.length > 240) {
    return { ok: false, error: "Tagline must be at most 240 characters." };
  }
  const tagline = taglineRaw ? taglineRaw : null;

  const address = normalizeOptionalText(input.address, 500);
  if (input.address?.trim() && !address) {
    return { ok: false, error: "Address must be at most 500 characters." };
  }

  const contactEmail = normalizeOptionalEmail(input.contactEmail);
  if (input.contactEmail?.trim() && !contactEmail) {
    return { ok: false, error: "Contact email must be a valid email address." };
  }

  const ownerContactPhone = normalizeOptionalPhone(input.contactPhone);
  if (input.contactPhone?.trim() && !ownerContactPhone) {
    return { ok: false, error: "Contact phone must be at most 40 characters." };
  }

  const websiteUrl = normalizeOptionalHttpsUrl(input.websiteUrl);
  if (input.websiteUrl?.trim() && !websiteUrl) {
    return { ok: false, error: "Website must be a valid https:// URL." };
  }

  const instagramUrl = normalizeInstagramUrl(input.instagramUrl);
  if (input.instagramUrl?.trim() && !instagramUrl) {
    return { ok: false, error: "Instagram must be @handle or a valid https:// URL." };
  }

  const pickupRaw = input.pickupInstructions?.trim() ?? "";
  if (pickupRaw.length > 2000) {
    return { ok: false, error: "Pickup instructions must be at most 2000 characters." };
  }
  const pickupInstructions = pickupRaw ? pickupRaw : null;

  const amenities = normalizePodAmenitiesInput(input.amenities ?? []);
  const customAmenities = normalizePodCustomAmenitiesInput(input.customAmenities ?? "");

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
      tagline,
      description,
      imageUrl: logoUrl,
      accentColor,
      address,
      contactEmail,
      ownerContactPhone,
      websiteUrl,
      instagramUrl,
      pickupInstructions,
      amenities: amenities.length > 0 ? amenities : Prisma.DbNull,
      customAmenities: customAmenities.length > 0 ? customAmenities : Prisma.DbNull,
    },
  });

  if (pod.imageUrl && pod.imageUrl !== logoUrl) {
    void deleteSupabasePublicObjectIfInBucket(pod.imageUrl);
  }

  revalidatePath(`/pod/${id}`);
  revalidatePath(buildPodCustomerPath(pod.slug));
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

  const pod = await prisma.pod.findUnique({ where: { id }, select: { id: true, slug: true } });
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
  revalidatePath(buildPodCustomerPath(pod.slug));
  revalidatePath(`/pod/${id}/settings`);
  revalidatePath(`/pod/${id}/dashboard`);
  for (const r of rows) {
    revalidatePath(`/pod/${id}/vendor/${r.vendorId}`);
    const vendor = await prisma.vendor.findUnique({
      where: { id: r.vendorId },
      select: { slug: true },
    });
    if (vendor) {
      revalidatePath(buildVendorMenuCustomerPath(pod.slug, vendor.slug));
    }
  }
  return { ok: true };
}
