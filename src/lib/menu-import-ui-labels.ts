/**
 * Shared friendly copy for vendor + admin menu import UIs.
 */
import type { MenuImportSource } from "@prisma/client";
import {
  vendorMenuImportListBadge,
  type VendorMenuImportListRow,
} from "@/lib/vendor-menu-import-labels";

export {
  vendorMenuImportListBadge,
  vendorMenuImportListBadgeClass,
  vendorMenuImportDetailPrimaryStatus,
} from "@/lib/vendor-menu-import-labels";

export function menuImportFriendlySource(source: MenuImportSource): string {
  switch (source) {
    case "DELIVERECT_MENU_WEBHOOK":
      return "Deliverect";
    case "DELIVERECT_API_PULL":
      return "Deliverect (sync)";
    default:
      return String(source);
  }
}

/** One-line summary for list tables (vendor + admin). */
export function menuImportListSummaryLine(
  job: VendorMenuImportListRow & { draftVersionId?: string | null }
): string {
  const blocking = job.issues.length;

  if (job.status === "awaiting_review" && job.draftVersionId) {
    if (blocking > 0) {
      return `${blocking} blocking issue${blocking === 1 ? "" : "s"} — resolve before publish`;
    }
    return "Unpublished changes — review to publish";
  }
  if (job.status === "succeeded") {
    return "Published";
  }
  if (job.status === "failed") {
    return "Import failed — see Advanced for details";
  }
  if (job.status === "cancelled" && job.errorCode === "DRAFT_DISCARDED") {
    return "Draft removed; history kept";
  }
  return vendorMenuImportListBadge(job).label;
}
