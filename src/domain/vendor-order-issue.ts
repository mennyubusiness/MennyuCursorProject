/**
 * Vendor workflow on customer OrderIssue rows (visibility + response only).
 */

export const VENDOR_ISSUE_STATUSES = [
  "unreviewed",
  "acknowledged",
  "vendor_reviewed",
  "resolution_requested",
] as const;

export type VendorIssueStatus = (typeof VENDOR_ISSUE_STATUSES)[number];

export const VENDOR_ISSUE_ACTIONS = [
  "acknowledge",
  "respond",
  "mark_vendor_reviewed",
  "request_resolution",
] as const;

export type VendorIssueAction = (typeof VENDOR_ISSUE_ACTIONS)[number];

export function isVendorIssueStatus(value: string | null | undefined): value is VendorIssueStatus {
  if (!value) return false;
  return (VENDOR_ISSUE_STATUSES as readonly string[]).includes(value);
}

export function vendorIssueStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "acknowledged":
      return "Acknowledged";
    case "vendor_reviewed":
      return "Vendor reviewed";
    case "resolution_requested":
      return "Resolution requested";
    case "unreviewed":
    default:
      return "Not yet reviewed";
  }
}

/** Customer refund link status safe for vendor UI (no Stripe / amounts). */
export function vendorVisibleCustomerRefundStatus(
  linkedRefundStatus: string | null | undefined
): string | null {
  if (!linkedRefundStatus) return null;
  switch (linkedRefundStatus) {
    case "pending":
    case "requires_action":
      return "Customer refund in progress";
    case "succeeded":
      return "Customer refunded";
    case "failed":
      return "Customer refund could not be completed";
    case "canceled":
      return "Customer refund canceled";
    default:
      return null;
  }
}
