import "server-only";

import { prisma } from "@/lib/db";
import { isReservedPublicSlug } from "@/lib/reserved-slugs";
import { slugifyBase } from "@/lib/slug";

export type SlugEntityType = "pod" | "vendor";

export function normalizePublicSlug(raw: string): string {
  return slugifyBase(raw);
}

export async function findSlugRedirectByOldSlug(oldSlug: string) {
  const key = oldSlug.trim().toLowerCase();
  if (!key) return null;
  return prisma.slugRedirect.findUnique({
    where: { oldSlug: key },
    select: { newSlug: true, entityType: true, entityId: true },
  });
}

export async function listSlugRedirectsForEntity(entityType: SlugEntityType, entityId: string) {
  return prisma.slugRedirect.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      oldSlug: true,
      newSlug: true,
      createdAt: true,
      reason: true,
    },
  });
}

export async function validatePublicSlug(input: {
  slug: string;
  entityType: SlugEntityType;
  entityId: string;
}): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  const slug = normalizePublicSlug(input.slug);
  if (!slug || slug.length < 2) {
    return { ok: false, error: "Slug must be at least 2 characters after normalization." };
  }
  if (isReservedPublicSlug(slug)) {
    return { ok: false, error: `Slug "${slug}" is reserved.` };
  }

  const [podMatch, vendorMatch, redirect] = await Promise.all([
    prisma.pod.findUnique({ where: { slug }, select: { id: true } }),
    prisma.vendor.findUnique({ where: { slug }, select: { id: true } }),
    prisma.slugRedirect.findUnique({ where: { oldSlug: slug }, select: { id: true } }),
  ]);

  if (podMatch && !(input.entityType === "pod" && podMatch.id === input.entityId)) {
    return { ok: false, error: `Slug "${slug}" is already used by a pod.` };
  }
  if (vendorMatch && !(input.entityType === "vendor" && vendorMatch.id === input.entityId)) {
    return { ok: false, error: `Slug "${slug}" is already used by a vendor.` };
  }
  if (redirect) return { ok: false, error: `Slug "${slug}" is reserved by a redirect.` };

  return { ok: true, slug };
}

export async function createSlugRedirect(input: {
  oldSlug: string;
  newSlug: string;
  entityType: SlugEntityType;
  entityId: string;
  adminUserId: string | null;
  reason: string;
}) {
  const oldKey = input.oldSlug.trim().toLowerCase();
  if (!oldKey || oldKey === input.newSlug) return;

  await prisma.slugRedirect.upsert({
    where: { oldSlug: oldKey },
    create: {
      oldSlug: oldKey,
      newSlug: input.newSlug,
      entityType: input.entityType,
      entityId: input.entityId,
      createdByAdminUserId: input.adminUserId,
      reason: input.reason,
    },
    update: {
      newSlug: input.newSlug,
      entityType: input.entityType,
      entityId: input.entityId,
      createdByAdminUserId: input.adminUserId,
      reason: input.reason,
    },
  });
}
