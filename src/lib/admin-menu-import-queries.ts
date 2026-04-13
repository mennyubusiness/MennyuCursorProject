/**
 * Read-only admin queries for menu import jobs (draft MenuVersion / issues). No live menu writes.
 */
import "server-only";
import { MenuImportJobStatus, MenuImportIssueSeverity, MenuVersionState, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const menuImportJobAdminInclude = {
  vendor: { select: { id: true, name: true, slug: true } },
  issues: { orderBy: { id: "asc" } },
  draftVersion: {
    select: {
      id: true,
      state: true,
      publishedAt: true,
      publishedBy: true,
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

/** List row for admin menu-imports table (includes payload hash + blocking issue ids for badges). */
export type AdminMenuImportJobListRow = Prisma.MenuImportJobGetPayload<{
  select: {
    id: true;
    source: true;
    status: true;
    startedAt: true;
    completedAt: true;
    draftVersionId: true;
    errorCode: true;
    vendorId: true;
    vendor: { select: { id: true; name: true; slug: true } };
    draftVersion: { select: { id: true; state: true; publishedBy: true } };
    menuImportRawPayload: { select: { payloadSha256: true } };
    issues: { select: { id: true } };
    _count: { select: { issues: true } };
  };
}>;

const adminMenuImportJobListSelect = {
  id: true,
  source: true,
  status: true,
  startedAt: true,
  completedAt: true,
  draftVersionId: true,
  errorCode: true,
  vendorId: true,
  vendor: { select: { id: true, name: true, slug: true } },
  draftVersion: { select: { id: true, state: true, publishedBy: true } },
  menuImportRawPayload: { select: { payloadSha256: true } },
  issues: {
    where: { severity: MenuImportIssueSeverity.blocking, waived: false },
    select: { id: true },
  },
  _count: { select: { issues: true } },
} satisfies Prisma.MenuImportJobSelect;

export async function fetchAdminMenuImportJobsList(limit = 100): Promise<AdminMenuImportJobListRow[]> {
  return prisma.menuImportJob.findMany({
    take: limit,
    orderBy: { startedAt: "desc" },
    select: adminMenuImportJobListSelect,
  });
}

/** Import jobs for a single vendor (admin menu management hub). */
export async function fetchAdminMenuImportJobsForVendor(
  vendorId: string,
  limit = 100
): Promise<AdminMenuImportJobListRow[]> {
  if (!vendorId?.trim()) return [];
  return prisma.menuImportJob.findMany({
    where: { vendorId: vendorId.trim() },
    take: limit,
    orderBy: { startedAt: "desc" },
    select: adminMenuImportJobListSelect,
  });
}

/**
 * Newest import job per vendor that can still be published: awaiting_review with a draft snapshot.
 * After publish, status becomes `succeeded` — those jobs are excluded.
 */
export async function getLatestActionableMenuImportJobForVendor(vendorId: string) {
  if (!vendorId?.trim()) return null;
  return prisma.menuImportJob.findFirst({
    where: {
      vendorId: vendorId.trim(),
      status: MenuImportJobStatus.awaiting_review,
      draftVersionId: { not: null },
    },
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      vendorId: true,
      source: true,
      status: true,
      startedAt: true,
      completedAt: true,
      draftVersionId: true,
      vendor: { select: { id: true, name: true, slug: true } },
    },
  });
}

/** Map vendorId → jobId for the latest actionable job (one query). */
export async function getLatestActionableMenuImportJobIdByVendorMap(
  vendorIds: string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(vendorIds.map((v) => v.trim()).filter(Boolean))];
  if (unique.length === 0) return new Map();

  const jobs = await prisma.menuImportJob.findMany({
    where: {
      vendorId: { in: unique },
      status: MenuImportJobStatus.awaiting_review,
      draftVersionId: { not: null },
    },
    orderBy: { startedAt: "desc" },
    select: { id: true, vendorId: true, startedAt: true },
  });

  const map = new Map<string, string>();
  for (const j of jobs) {
    if (!map.has(j.vendorId)) map.set(j.vendorId, j.id);
  }
  return map;
}

export type PendingMenuImportJobsSummary = {
  /** Jobs with draft awaiting admin publish (same filter as publish eligibility gate). */
  awaitingReviewCount: number;
  /** Distinct vendors that have at least one such job. */
  vendorsWithPendingCount: number;
};

export async function fetchPendingMenuImportJobsSummary(): Promise<PendingMenuImportJobsSummary> {
  const base = {
    status: MenuImportJobStatus.awaiting_review,
    draftVersionId: { not: null },
  } as const;

  const [awaitingReviewCount, vendorRows] = await prisma.$transaction([
    prisma.menuImportJob.count({ where: base }),
    prisma.menuImportJob.findMany({
      where: base,
      select: { vendorId: true },
      distinct: ["vendorId"],
    }),
  ]);

  return {
    awaitingReviewCount,
    vendorsWithPendingCount: vendorRows.length,
  };
}

/**
 * Jobs that share the same raw payload hash (e.g. duplicate webhook deliveries with different idempotency keys).
 * Used for UI badges only — does not change which job is "latest".
 */
export function getDuplicatePayloadShaJobIdSets(
  jobs: Array<{ id: string; menuImportRawPayload: { payloadSha256: string } | null }>
): Map<string, Set<string>> {
  const bySha = new Map<string, Set<string>>();
  for (const j of jobs) {
    const sha = j.menuImportRawPayload?.payloadSha256;
    if (!sha) continue;
    let set = bySha.get(sha);
    if (!set) {
      set = new Set<string>();
      bySha.set(sha, set);
    }
    set.add(j.id);
  }
  const duplicates = new Map<string, Set<string>>();
  for (const [sha, ids] of bySha) {
    if (ids.size > 1) duplicates.set(sha, ids);
  }
  return duplicates;
}

/** True if this job id appears in a duplicate raw-payload group (same SHA as another job). */
export function isDuplicatePayloadJob(jobId: string, duplicateSetsBySha: Map<string, Set<string>>): boolean {
  for (const set of duplicateSetsBySha.values()) {
    if (set.has(jobId)) return true;
  }
  return false;
}

/** Aliases for certification/docs naming. */
export { getLatestActionableMenuImportJobForVendor as getLatestMenuImportJobByVendor };
export { fetchPendingMenuImportJobsSummary as getPendingMenuImportJobsSummary };

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
