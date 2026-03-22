/**
 * Read-only admin queries for menu import jobs (draft MenuVersion / issues). No live menu writes.
 */
import "server-only";
import { Prisma } from "@prisma/client";
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
