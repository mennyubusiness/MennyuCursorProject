/**
 * Vendor-facing copy for menu import jobs (list + detail). Internal statuses stay in DB/audit.
 */
import type { MenuImportJobStatus } from "@prisma/client";

export type VendorMenuImportListRow = {
  status: MenuImportJobStatus;
  errorCode: string | null;
  issues: { id: string }[];
  draftVersion: { publishedBy: string | null } | null;
};

/** Badge content for a row on the vendor menu imports list. */
export type VendorMenuImportBadgeTone =
  | "success"
  | "auto"
  | "review"
  | "blocked"
  | "failed"
  | "discarded"
  | "neutral";

export function vendorMenuImportListBadge(job: VendorMenuImportListRow): {
  label: string;
  tone: VendorMenuImportBadgeTone;
} {
  const blocking = job.issues.length;

  if (job.status === "cancelled" && job.errorCode === "DRAFT_DISCARDED") {
    return { label: "Draft discarded", tone: "discarded" };
  }
  if (job.status === "cancelled") {
    return { label: "Cancelled", tone: "neutral" };
  }
  if (job.status === "failed") {
    return { label: "Import failed", tone: "failed" };
  }
  if (job.status === "succeeded") {
    const by = job.draftVersion?.publishedBy ?? "";
    if (by.startsWith("auto:")) {
      return { label: "Published automatically", tone: "auto" };
    }
    if (by.startsWith("admin:")) {
      return { label: "Published by Mennyu admin", tone: "success" };
    }
    return { label: "Published", tone: "success" };
  }
  if (job.status === "awaiting_review") {
    if (blocking > 0) {
      return { label: "Blocked by issues", tone: "blocked" };
    }
    return { label: "New menu update available", tone: "review" };
  }
  return { label: "Processing", tone: "neutral" };
}

export function vendorMenuImportListBadgeClass(tone: VendorMenuImportBadgeTone): string {
  switch (tone) {
    case "success":
      return "rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900";
    case "auto":
      return "rounded bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-900";
    case "review":
      return "rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900";
    case "blocked":
      return "rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-900";
    case "failed":
      return "rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-900";
    case "discarded":
      return "rounded bg-stone-200 px-2 py-0.5 text-xs font-medium text-stone-800";
    default:
      return "rounded bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-800";
  }
}

/** One-line status for the job detail “Summary” section. */
export function vendorMenuImportDetailPrimaryStatus(job: {
  status: MenuImportJobStatus;
  errorCode: string | null;
  draftVersion: { publishedBy: string | null } | null;
  blockingIssueCount: number;
}): string {
  const blocking = job.blockingIssueCount;
  if (job.status === "cancelled" && job.errorCode === "DRAFT_DISCARDED") {
    return "Draft discarded (import kept for history)";
  }
  if (job.status === "failed") {
    return "Import failed";
  }
  if (job.status === "succeeded") {
    const by = job.draftVersion?.publishedBy ?? "";
    if (by.startsWith("auto:")) {
      return "Published automatically";
    }
    if (by.startsWith("admin:")) {
      return "Published by Mennyu admin (support)";
    }
    if (by.startsWith("user:")) {
      return "Published from your account";
    }
    if (by.startsWith("vendor:")) {
      return "Published from your dashboard";
    }
    return "Published";
  }
  if (job.status === "awaiting_review") {
    if (blocking > 0) {
      return "Blocked by issues — fix in Deliverect or ask Mennyu support";
    }
    return "Needs review — open Publish when ready";
  }
  return String(job.status);
}
