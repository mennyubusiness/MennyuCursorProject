/**
 * Read-only admin queries for menu import jobs (draft MenuVersion / issues). No live menu writes.
 */
import "server-only";
import { MenuVersionState, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const menuImportJobAdminInclude = {
  vendor: { select: { id: true, name: true, slug: true } },
  issues: { orderBy: { id: "asc" } },
  draftVersion: {
    select: {
      id: true,
      state: true,
      canonicalSnapshot: true,
      canonicalSnapshotSha256: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  menuImportRawPayload: {
    select: {
      id: true,
      payload: true,
      payloadSha256: true,
      deliverectApiVersion: true,
      createdAt: true,
    },
  },
} satisfies Prisma.MenuImportJobInclude;

export type AdminMenuImportJobDetail = Prisma.MenuImportJobGetPayload<{
  include: typeof menuImportJobAdminInclude;
}>;

export async function fetchAdminMenuImportJobDetail(
  jobId: string
): Promise<AdminMenuImportJobDetail | null> {
  if (!jobId?.trim()) return null;
  return prisma.menuImportJob.findUnique({
    where: { id: jobId.trim() },
    include: menuImportJobAdminInclude,
  });
}

/** Latest published canonical menu for vendor (baseline for draft-vs-published diff). Read-only. */
export async function fetchLatestPublishedMenuVersionForVendor(vendorId: string) {
  if (!vendorId?.trim()) return null;
  return prisma.menuVersion.findFirst({
    where: { vendorId: vendorId.trim(), state: MenuVersionState.published },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      publishedAt: true,
      publishedBy: true,
      createdAt: true,
      canonicalSnapshot: true,
      canonicalSnapshotSha256: true,
    },
  });
}

/** One query: latest published MenuVersion id per vendor (for batch discard eligibility on list). */
export async function fetchLatestPublishedMenuVersionIdByVendorMap(
  vendorIds: string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(vendorIds.map((v) => v.trim()).filter(Boolean))];
  if (unique.length === 0) return new Map();

  const rows = await prisma.menuVersion.findMany({
    where: { vendorId: { in: unique }, state: MenuVersionState.published },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: { id: true, vendorId: true },
  });

  const map = new Map<string, string>();
  for (const r of rows) {
    if (!map.has(r.vendorId)) map.set(r.vendorId, r.id);
  }
  return map;
}

export async function fetchAdminMenuImportJobsList(limit = 50) {
  return prisma.menuImportJob.findMany({
    take: limit,
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      source: true,
      status: true,
      startedAt: true,
      completedAt: true,
      draftVersionId: true,
      errorCode: true,
      vendor: { select: { id: true, name: true } },
      draftVersion: { select: { id: true, state: true } },
      _count: { select: { issues: true } },
    },
  });
}

/** Stable sort: blocking → warning → info, then code (Prisma DB order is not guaranteed). */
export function sortMenuImportIssuesForDisplay<T extends { severity: string; code: string }>(
  issues: T[]
): T[] {
  const rank: Record<string, number> = { blocking: 0, warning: 1, info: 2 };
  return [...issues].sort((a, b) => {
    const ra = rank[a.severity] ?? 99;
    const rb = rank[b.severity] ?? 99;
    if (ra !== rb) return ra - rb;
    return a.code.localeCompare(b.code);
  });
}
