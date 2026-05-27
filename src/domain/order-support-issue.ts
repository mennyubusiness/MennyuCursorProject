/**
 * Customer-reported order support issues (OrderIssue rows with submittedByRole customer).
 */

export const CUSTOMER_SUPPORT_ISSUE_TYPES = [
  "missing_item",
  "wrong_item",
  "vendor_cancelled",
  "vendor_closed",
  "long_wait",
  "duplicate_charge",
  "payment_or_refund_issue",
  "other",
] as const;

export type CustomerSupportIssueType = (typeof CUSTOMER_SUPPORT_ISSUE_TYPES)[number];

export const ORDER_ISSUE_PRIORITIES = ["low", "normal", "high"] as const;
export type OrderIssuePriority = (typeof ORDER_ISSUE_PRIORITIES)[number];

export const ORDER_ISSUE_STATUSES = ["open", "reviewing", "resolved", "dismissed"] as const;
export type OrderIssueStatus = (typeof ORDER_ISSUE_STATUSES)[number];

export const ORDER_ISSUE_SUBMITTED_BY_ROLES = [
  "customer",
  "vendor",
  "admin",
  "system",
] as const;
export type OrderIssueSubmittedByRole = (typeof ORDER_ISSUE_SUBMITTED_BY_ROLES)[number];

/** Status values that count as active (includes legacy OPEN). */
export const ACTIVE_ORDER_ISSUE_STATUSES = ["open", "reviewing", "OPEN"] as const;

export function normalizeOrderIssueStatus(status: string): OrderIssueStatus | "OPEN" {
  const s = status.trim().toLowerCase();
  if (s === "open" || status === "OPEN") return s === "open" ? "open" : "OPEN";
  if (s === "reviewing") return "reviewing";
  if (s === "resolved" || status === "RESOLVED") return "resolved";
  if (s === "dismissed") return "dismissed";
  return "open";
}

export function isActiveOrderIssueStatus(status: string): boolean {
  const n = status.trim();
  return (
    n === "OPEN" ||
    n === "open" ||
    n === "reviewing"
  );
}

export function customerSupportIssueTypeLabel(type: string): string {
  switch (type) {
    case "missing_item":
      return "Missing item";
    case "wrong_item":
      return "Wrong item";
    case "vendor_cancelled":
      return "Vendor cancelled";
    case "vendor_closed":
      return "Vendor closed";
    case "long_wait":
      return "Long wait";
    case "duplicate_charge":
      return "Duplicate charge";
    case "payment_or_refund_issue":
      return "Payment or refund";
    case "other":
      return "Other";
    default:
      return type.replace(/_/g, " ");
  }
}

export function customerSupportIssueStatusMessage(status: string): string {
  const n = normalizeOrderIssueStatus(status);
  if (n === "OPEN" || n === "open") return "We received your issue.";
  if (n === "reviewing") return "Our team is reviewing this.";
  if (n === "resolved") return "This issue has been resolved.";
  if (n === "dismissed") return "This issue has been closed.";
  return "We received your issue.";
}

export function isCustomerSupportIssueType(type: string): type is CustomerSupportIssueType {
  return (CUSTOMER_SUPPORT_ISSUE_TYPES as readonly string[]).includes(type);
}
