export type AdminIncidentSeverity = "critical" | "warning" | "info";

export type AdminIncidentType =
  | "stuck_order"
  | "routing_failed"
  | "routing_stuck"
  | "fulfillment_stuck"
  | "order_status_mismatch"
  | "open_issue"
  | "payment"
  | "sms_failed"
  | "sms_suppressed"
  | "vendor_no_items"
  | "pod_no_vendors"
  | "webhook_failed"
  | "refund_failed"
  | "refund_review"
  | "vendor_clawback"
  | "other";

export type AdminIncidentEntityType =
  | "order"
  | "vendor_order"
  | "payment"
  | "vendor"
  | "pod"
  | "notification"
  | "webhook"
  | "issue";

export type AdminIncidentRow = {
  id: string;
  severity: AdminIncidentSeverity;
  type: AdminIncidentType;
  entityType: AdminIncidentEntityType;
  entityId: string;
  entityLabel: string;
  description: string;
  reasonDetail: string;
  detectedAt: Date;
  updatedAt: Date | null;
  currentState: string;
  recommendedAction: string;
  adminHref: string;
  status: "open";
};

export const INCIDENT_TYPE_OPTIONS: { value: AdminIncidentType | "all"; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "stuck_order", label: "Stuck order" },
  { value: "routing_failed", label: "Routing failed" },
  { value: "order_status_mismatch", label: "Order status mismatch" },
  { value: "payment", label: "Payment / checkout" },
  { value: "open_issue", label: "Open issue" },
  { value: "sms_failed", label: "SMS failed" },
  { value: "pod_no_vendors", label: "Pod no vendors" },
  { value: "vendor_no_items", label: "Vendor no items" },
  { value: "webhook_failed", label: "Webhook failed" },
];

export const INCIDENT_SEVERITY_OPTIONS: { value: AdminIncidentSeverity | "all"; label: string }[] = [
  { value: "all", label: "All severities" },
  { value: "critical", label: "Critical" },
  { value: "warning", label: "Warning" },
  { value: "info", label: "Info" },
];
