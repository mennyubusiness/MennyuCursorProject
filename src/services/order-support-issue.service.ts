/**
 * Customer support issues on OrderIssue (intake + admin workflow).
 * Does not trigger refunds — admins use Payments & Refunds separately.
 */
import { prisma } from "@/lib/db";
import {
  ACTIVE_ORDER_ISSUE_STATUSES,
  customerSupportIssueStatusMessage,
  type CustomerSupportIssueType,
  type OrderIssueStatus,
  isActiveOrderIssueStatus,
  isCustomerSupportIssueType,
} from "@/domain/order-support-issue";

export type CreateCustomerSupportIssueInput = {
  orderId: string;
  issueType: CustomerSupportIssueType;
  vendorOrderId?: string | null;
  orderLineItemId?: string | null;
  customerMessage?: string | null;
  submittedByUserId?: string | null;
};

export type CustomerSupportIssueSafe = {
  id: string;
  issueType: string;
  status: string;
  statusMessage: string;
  vendorOrderId: string | null;
  orderLineItemId: string | null;
  customerMessage: string | null;
  createdAt: string;
};

function toSafeIssue(row: {
  id: string;
  type: string;
  status: string;
  vendorOrderId: string | null;
  orderLineItemId: string | null;
  customerMessage: string | null;
  createdAt: Date;
}): CustomerSupportIssueSafe {
  return {
    id: row.id,
    issueType: row.type,
    status: row.status,
    statusMessage: customerSupportIssueStatusMessage(row.status),
    vendorOrderId: row.vendorOrderId,
    orderLineItemId: row.orderLineItemId,
    customerMessage: row.customerMessage,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function validateSupportIssueScope(input: {
  orderId: string;
  vendorOrderId?: string | null;
  orderLineItemId?: string | null;
}): Promise<
  | { ok: true }
  | { ok: false; code: string; message: string }
> {
  if (input.orderLineItemId) {
    const line = await prisma.orderLineItem.findUnique({
      where: { id: input.orderLineItemId },
      select: { id: true, vendorOrderId: true, vendorOrder: { select: { orderId: true } } },
    });
    if (!line || line.vendorOrder.orderId !== input.orderId) {
      return { ok: false, code: "INVALID_LINE_ITEM", message: "Line item does not belong to this order." };
    }
    if (input.vendorOrderId && input.vendorOrderId !== line.vendorOrderId) {
      return {
        ok: false,
        code: "SCOPE_MISMATCH",
        message: "Line item does not belong to the selected vendor order.",
      };
    }
    return { ok: true };
  }

  if (input.vendorOrderId) {
    const vo = await prisma.vendorOrder.findUnique({
      where: { id: input.vendorOrderId },
      select: { orderId: true },
    });
    if (!vo || vo.orderId !== input.orderId) {
      return { ok: false, code: "INVALID_VENDOR_ORDER", message: "Vendor order does not belong to this order." };
    }
  }

  return { ok: true };
}

export async function findDuplicateOpenCustomerIssue(input: {
  orderId: string;
  issueType: string;
  vendorOrderId?: string | null;
  orderLineItemId?: string | null;
}) {
  return prisma.orderIssue.findFirst({
    where: {
      orderId: input.orderId,
      type: input.issueType,
      submittedByRole: "customer",
      vendorOrderId: input.vendorOrderId ?? null,
      orderLineItemId: input.orderLineItemId ?? null,
      status: { in: [...ACTIVE_ORDER_ISSUE_STATUSES] },
    },
    select: { id: true },
  });
}

export async function createCustomerSupportIssue(
  input: CreateCustomerSupportIssueInput
): Promise<
  | { ok: true; issue: CustomerSupportIssueSafe; created: boolean }
  | { ok: false; code: string; message: string; status: number }
> {
  if (!isCustomerSupportIssueType(input.issueType)) {
    return { ok: false, code: "INVALID_ISSUE_TYPE", message: "Invalid issue type.", status: 400 };
  }

  const scope = await validateSupportIssueScope({
    orderId: input.orderId,
    vendorOrderId: input.vendorOrderId,
    orderLineItemId: input.orderLineItemId,
  });
  if (!scope.ok) {
    return { ok: false, code: scope.code, message: scope.message, status: 400 };
  }

  const duplicate = await findDuplicateOpenCustomerIssue({
    orderId: input.orderId,
    issueType: input.issueType,
    vendorOrderId: input.vendorOrderId,
    orderLineItemId: input.orderLineItemId,
  });
  if (duplicate) {
    return {
      ok: false,
      code: "DUPLICATE_OPEN_ISSUE",
      message: "You already have an open report for this issue. Our team will review it.",
      status: 409,
    };
  }

  const row = await prisma.orderIssue.create({
    data: {
      orderId: input.orderId,
      vendorOrderId: input.vendorOrderId ?? null,
      orderLineItemId: input.orderLineItemId ?? null,
      type: input.issueType,
      severity: "MEDIUM",
      priority: "normal",
      status: "open",
      submittedByRole: "customer",
      submittedByUserId: input.submittedByUserId ?? null,
      customerMessage: input.customerMessage?.trim() || null,
      internalNote: null,
      notes: null,
      createdBy: "customer",
    },
  });

  const { sendOrderIssueMilestone } = await import(
    "@/services/customer-order-notification.service"
  );
  await sendOrderIssueMilestone(input.orderId, row.id);

  return { ok: true, issue: toSafeIssue(row), created: true };
}

const customerIssueSelect = {
  id: true,
  type: true,
  status: true,
  vendorOrderId: true,
  orderLineItemId: true,
  customerMessage: true,
  createdAt: true,
} as const;

export async function listCustomerSupportIssuesForOrder(
  orderId: string
): Promise<CustomerSupportIssueSafe[]> {
  const rows = await prisma.orderIssue.findMany({
    where: {
      orderId,
      submittedByRole: "customer",
    },
    orderBy: { createdAt: "desc" },
    select: customerIssueSelect,
  });
  return rows.map(toSafeIssue);
}

export async function getCustomerSupportIssuesForOrder(orderId: string) {
  return listCustomerSupportIssuesForOrder(orderId);
}

export type AdminSupportIssueRow = {
  id: string;
  orderId: string;
  issueType: string;
  status: string;
  priority: string | null;
  severity: string;
  vendorOrderId: string | null;
  vendorName: string | null;
  orderLineItemId: string | null;
  lineItemName: string | null;
  customerMessage: string | null;
  internalNote: string | null;
  notes: string | null;
  submittedByRole: string | null;
  linkedOrderRefundId: string | null;
  linkedRefundStatus: string | null;
  linkedRefundAmountCents: number | null;
  vendorResponse: string | null;
  vendorRespondedAt: string | null;
  vendorIssueStatus: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
};

export async function listAdminSupportIssuesForOrder(orderId: string): Promise<AdminSupportIssueRow[]> {
  const rows = await prisma.orderIssue.findMany({
    where: { orderId, submittedByRole: "customer" },
    orderBy: { createdAt: "desc" },
    include: {
      vendorOrder: { select: { vendor: { select: { name: true } } } },
      orderLineItem: { select: { name: true } },
      linkedOrderRefund: { select: { status: true, amountCents: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    orderId: r.orderId,
    issueType: r.type,
    status: r.status,
    priority: r.priority,
    severity: r.severity,
    vendorOrderId: r.vendorOrderId,
    vendorName: r.vendorOrder?.vendor.name ?? null,
    orderLineItemId: r.orderLineItemId,
    lineItemName: r.orderLineItem?.name ?? null,
    customerMessage: r.customerMessage,
    internalNote: r.internalNote ?? r.notes,
    notes: r.notes,
    submittedByRole: r.submittedByRole,
    linkedOrderRefundId: r.linkedOrderRefundId,
    linkedRefundStatus: r.linkedOrderRefund?.status ?? null,
    linkedRefundAmountCents: r.linkedOrderRefund?.amountCents ?? null,
    vendorResponse: r.vendorResponse,
    vendorRespondedAt: r.vendorRespondedAt?.toISOString() ?? null,
    vendorIssueStatus: r.vendorIssueStatus,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    resolvedAt: r.resolvedAt?.toISOString() ?? null,
  }));
}

export async function updateAdminSupportIssue(
  issueId: string,
  input: {
    status?: OrderIssueStatus;
    internalNote?: string | null;
    linkedOrderRefundId?: string | null;
    resolvedByUserId?: string | null;
  }
): Promise<{ ok: true } | { ok: false; message: string }> {
  const issue = await prisma.orderIssue.findUnique({
    where: { id: issueId },
    select: { id: true, orderId: true, submittedByRole: true },
  });
  if (!issue) return { ok: false, message: "Issue not found" };

  if (input.linkedOrderRefundId) {
    const refund = await prisma.orderRefund.findFirst({
      where: { id: input.linkedOrderRefundId, orderId: issue.orderId },
      select: { id: true },
    });
    if (!refund) {
      return { ok: false, message: "Refund does not belong to this order." };
    }
  }

  const data: {
    status?: string;
    internalNote?: string | null;
    notes?: string | null;
    linkedOrderRefundId?: string | null;
    resolvedAt?: Date | null;
    resolvedBy?: string | null;
    resolvedByUserId?: string | null;
  } = {};

  if (input.status) {
    data.status = input.status;
    if (input.status === "resolved" || input.status === "dismissed") {
      data.resolvedAt = new Date();
      data.resolvedBy = input.resolvedByUserId ? "admin" : "admin";
      data.resolvedByUserId = input.resolvedByUserId ?? null;
    }
    if (input.status === "open" || input.status === "reviewing") {
      data.resolvedAt = null;
      data.resolvedBy = null;
      data.resolvedByUserId = null;
    }
  }

  if (input.internalNote !== undefined) {
    data.internalNote = input.internalNote;
    data.notes = input.internalNote;
  }

  if (input.linkedOrderRefundId !== undefined) {
    data.linkedOrderRefundId = input.linkedOrderRefundId;
  }

  await prisma.orderIssue.update({ where: { id: issueId }, data });
  return { ok: true };
}

/** Open/reviewing customer issues for admin attention queue. */
export async function listOpenCustomerSupportIssuesForAttention(limit: number) {
  return prisma.orderIssue.findMany({
    where: {
      submittedByRole: "customer",
      status: { in: [...ACTIVE_ORDER_ISSUE_STATUSES] },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: {
      order: { select: { id: true, customerPhone: true, pod: { select: { id: true, name: true } } } },
      vendorOrder: { select: { vendor: { select: { name: true } } } },
    },
  });
}

export type ValidateLinkedIssueForRefundResult =
  | {
      ok: true;
      issue: {
        id: string;
        orderId: string;
        vendorOrderId: string | null;
        orderLineItemId: string | null;
      };
    }
  | { ok: false; code: string; message: string };

/**
 * Ensures linkedOrderIssueId belongs to the order and vendor scope matches the refund.
 */
export async function validateLinkedOrderIssueForAdminRefund(input: {
  orderId: string;
  linkedOrderIssueId: string;
  refundScope:
    | "full_order"
    | "full_vendor_order"
    | "custom_vendor_partial"
    | "line_item_refund";
  refundVendorOrderId?: string | null;
  refundOrderLineItemId?: string | null;
}): Promise<ValidateLinkedIssueForRefundResult> {
  const issue = await prisma.orderIssue.findFirst({
    where: {
      id: input.linkedOrderIssueId,
      orderId: input.orderId,
      submittedByRole: "customer",
    },
    select: {
      id: true,
      orderId: true,
      vendorOrderId: true,
      orderLineItemId: true,
    },
  });

  if (!issue) {
    return {
      ok: false,
      code: "ISSUE_NOT_FOUND",
      message: "Linked issue not found on this order.",
    };
  }

  if (
    issue.vendorOrderId &&
    input.refundScope !== "full_order" &&
    input.refundVendorOrderId !== issue.vendorOrderId
  ) {
    return {
      ok: false,
      code: "ISSUE_VENDOR_MISMATCH",
      message:
        "This issue is scoped to a specific vendor order. Use a refund for that vendor order.",
    };
  }

  if (
    issue.orderLineItemId &&
    input.refundScope === "line_item_refund" &&
    input.refundOrderLineItemId !== issue.orderLineItemId
  ) {
    return {
      ok: false,
      code: "ISSUE_LINE_ITEM_MISMATCH",
      message:
        "This issue is scoped to a specific line item. Refund that line item to link correctly.",
    };
  }

  return { ok: true, issue };
}

export async function linkSupportIssueToOrderRefund(input: {
  orderId: string;
  orderRefundId: string;
  issueId?: string | null;
  /** When false, only link if refund row is succeeded (default true for admin auto-link after Stripe success). */
  requireRefundSucceeded?: boolean;
}): Promise<void> {
  if (!input.issueId) return;
  const issue = await prisma.orderIssue.findFirst({
    where: { id: input.issueId, orderId: input.orderId, submittedByRole: "customer" },
    select: { id: true },
  });
  if (!issue) return;

  if (input.requireRefundSucceeded !== false) {
    const refund = await prisma.orderRefund.findFirst({
      where: { id: input.orderRefundId, orderId: input.orderId },
      select: { status: true },
    });
    if (!refund || refund.status !== "succeeded") {
      return;
    }
  }

  await prisma.orderIssue.update({
    where: { id: issue.id },
    data: { linkedOrderRefundId: input.orderRefundId },
  });
}

export { isActiveOrderIssueStatus };
