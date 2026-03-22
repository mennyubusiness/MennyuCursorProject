/**
 * Admin read-only: published / archived MenuVersion history for a vendor (no live writes).
 */
import "server-only";
import { MenuVersionState } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  getCanonicalMenuSummaryCounts,
  type CanonicalMenuSummaryCounts,
} from "@/domain/menu-import/canonical-menu-summary";

export type AdminVendorMenuVersionHistoryRow = {
  id: string;
  state: MenuVersionState;
  publishedAt: Date | null;
  publishedBy: string | null;
  restoredFromMenuVersionId: string | null;
  createdAt: Date;
  summary: CanonicalMenuSummaryCounts | null;
  summaryParseError: string | null;
};

export async function fetchVendorMenuVersionHistoryForAdmin(
  vendorId: string
): Promise<AdminVendorMenuVersionHistoryRow[]> {
  if (!vendorId?.trim()) return [];

  const rows = await prisma.menuVersion.findMany({
    where: {
      vendorId: vendorId.trim(),
      state: { in: [MenuVersionState.published, MenuVersionState.archived] },
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      state: true,
      publishedAt: true,
      publishedBy: true,
      restoredFromMenuVersionId: true,
      createdAt: true,
      canonicalSnapshot: true,
    },
  });

  return rows.map((r) => {
    const counts = getCanonicalMenuSummaryCounts(r.canonicalSnapshot);
    return {
      id: r.id,
      state: r.state,
      publishedAt: r.publishedAt,
      publishedBy: r.publishedBy,
      restoredFromMenuVersionId: r.restoredFromMenuVersionId,
      createdAt: r.createdAt,
      summary: counts.ok ? counts.summary : null,
      summaryParseError: counts.ok ? null : counts.parseError,
    };
  });
}
