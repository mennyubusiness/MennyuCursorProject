import type { OrderRefundInitiatedByRole } from "@prisma/client";
import type { RefundReason } from "@/lib/refund-decision";

export function mapRefundReasonToInitiatedByRole(reason: RefundReason): OrderRefundInitiatedByRole {
  switch (reason) {
    case "customer_cancel":
      return "customer";
    case "vendor_denial":
      return "vendor";
    case "admin_manual_resolution":
      return "admin";
    default:
      return "system";
  }
}
