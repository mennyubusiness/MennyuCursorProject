/**
 * Vendor-scoped customer OrderIssue visibility (read + vendor response only).
 * Does not create refunds or change admin/customer issue status.
 */
import { prisma } from "@/lib/db";
import {
  ACTIVE_ORDER_ISSUE_STATUSES,
  customerSupportIssueTypeLabel,
  isActiveOrderIssueStatus,
} from "@/domain/order-support-issue";
import {
  VENDOR_ISSUE_ACTIONS,
  type VendorIssueAction,
  type VendorIssueStatus,
  vendorIssueStatusLabel,
  vendorVisibleCustomerRefundStatus,
} from "@/domain/vendor-order-issue";
import { getPickupCode } from "@/lib/pickup-code";

function vendorIssueAccessFilter(vendorId: string) {
  return {
    submittedByRole: "customer" as const,
    OR: [
      { vendorOrder: { vendorId } },
      { orderLineItem: { vendorOrder: { vendorId } } },
    ],
  };
}

export type VendorOrderIssueRow = {
  id: string;
  issueType: string;
  issueTypeLabel: string;
  status: string;
  vendorIssueStatus: string | null;
  vendorIssueStatusLabel: string;
  customerMessage: string | null;
  vendorResponse: string | null;
  vendorRespondedAt: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  orderId: string;
  pickupCode: string;
  vendorOrderId: string;
  vendorOrderFulfillmentStatus: string;
  vendorOrderRoutingStatus: string;
  orderLineItemId: string | null;
  lineItemName: string | null;
  customerRefundStatus: string | null;
  isActive: boolean;
};

function toVendorRow(row: {
  id: string;
  type: string;
  status: string;
  vendorIssueStatus: string | null;
  customerMessage: string | null;
  vendorResponse: string | null;
  vendorRespondedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  orderId: string;
  orderLineItemId: string | null;
  vendorOrderId: string | null;
  orderLineItem: {
    name: string;
    vendorOrderId: string;
    vendorOrder: { id: string; fulfillmentStatus: string; routingStatus: string };
  } | null;
  vendorOrder: {
    id: string;
    fulfillmentStatus: string;
    routingStatus: string;
  } | null;
  linkedOrderRefund: { status: string } | null;
}): VendorOrderIssueRow | null {
  const vo = row.vendorOrder ?? row.orderLineItem?.vendorOrder;
  const vendorOrderId = row.vendorOrderId ?? row.orderLineItem?.vendorOrderId ?? vo?.id;
  if (!vendorOrderId || !vo) return null;

  return {
    id: row.id,
    issueType: row.type,
    issueTypeLabel: customerSupportIssueTypeLabel(row.type),
    status: row.status,
    vendorIssueStatus: row.vendorIssueStatus,
    vendorIssueStatusLabel: vendorIssueStatusLabel(row.vendorIssueStatus),
    customerMessage: row.customerMessage,
    vendorResponse: row.vendorResponse,
    vendorRespondedAt: row.vendorRespondedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    orderId: row.orderId,
    pickupCode: getPickupCode(row.orderId),
    vendorOrderId,
    vendorOrderFulfillmentStatus: vo.fulfillmentStatus,
    vendorOrderRoutingStatus: vo.routingStatus,
    orderLineItemId: row.orderLineItemId,
    lineItemName: row.orderLineItem?.name ?? null,
    customerRefundStatus: vendorVisibleCustomerRefundStatus(row.linkedOrderRefund?.status),
    isActive: isActiveOrderIssueStatus(row.status),
  };
}

const vendorIssueInclude = {
  orderLineItem: {
    select: {
      name: true,
      vendorOrderId: true,
      vendorOrder: { select: { id: true, fulfillmentStatus: true, routingStatus: true } },
    },
  },
  vendorOrder: {
    select: { id: true, fulfillmentStatus: true, routingStatus: true },
  },
  linkedOrderRefund: { select: { status: true } },
} as const;

export async function listVendorOrderIssues(
  vendorId: string,
  filter: "active" | "closed" | "all" = "active"
): Promise<VendorOrderIssueRow[]> {
  const statusFilter =
    filter === "active"
      ? { status: { in: [...ACTIVE_ORDER_ISSUE_STATUSES] } }
      : filter === "closed"
        ? { status: { notIn: [...ACTIVE_ORDER_ISSUE_STATUSES] } }
        : {};

  const rows = await prisma.orderIssue.findMany({
    where: {
      ...vendorIssueAccessFilter(vendorId),
      ...statusFilter,
    },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      type: true,
      status: true,
      vendorIssueStatus: true,
      customerMessage: true,
      vendorResponse: true,
      vendorRespondedAt: true,
      createdAt: true,
      updatedAt: true,
      resolvedAt: true,
      orderId: true,
      vendorOrderId: true,
      orderLineItemId: true,
      orderLineItem: vendorIssueInclude.orderLineItem,
      vendorOrder: vendorIssueInclude.vendorOrder,
      linkedOrderRefund: vendorIssueInclude.linkedOrderRefund,
    },
  });

  const mapped: VendorOrderIssueRow[] = [];
  for (const row of rows) {
    const safe = toVendorRow(row);
    if (safe) mapped.push(safe);
  }

  mapped.sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return mapped;
}

export async function getVendorOrderIssueForVendor(
  vendorId: string,
  issueId: string
): Promise<VendorOrderIssueRow | null> {
  const row = await prisma.orderIssue.findFirst({
    where: {
      id: issueId,
      ...vendorIssueAccessFilter(vendorId),
    },
    select: {
      id: true,
      type: true,
      status: true,
      vendorIssueStatus: true,
      customerMessage: true,
      vendorResponse: true,
      vendorRespondedAt: true,
      createdAt: true,
      updatedAt: true,
      resolvedAt: true,
      orderId: true,
      vendorOrderId: true,
      orderLineItemId: true,
      orderLineItem: vendorIssueInclude.orderLineItem,
      vendorOrder: vendorIssueInclude.vendorOrder,
      linkedOrderRefund: vendorIssueInclude.linkedOrderRefund,
    },
  });
  if (!row) return null;
  return toVendorRow(row);
}

export type UpdateVendorOrderIssueInput = {
  action: VendorIssueAction;
  vendorResponse?: string | null;
  userId?: string | null;
};

export async function updateVendorOrderIssue(
  vendorId: string,
  issueId: string,
  input: UpdateVendorOrderIssueInput
): Promise<
  | { ok: true; issue: VendorOrderIssueRow }
  | { ok: false; code: string; message: string; status: number }
> {
  const existing = await getVendorOrderIssueForVendor(vendorId, issueId);
  if (!existing) {
    return { ok: false, code: "NOT_FOUND", message: "Issue not found.", status: 404 };
  }

  const trimmedResponse = input.vendorResponse?.trim() ?? "";
  const now = new Date();

  let vendorIssueStatus: VendorIssueStatus | undefined;
  const data: {
    vendorResponse?: string;
    vendorRespondedAt?: Date;
    vendorRespondedByUserId?: string | null;
    vendorIssueStatus?: string;
  } = {};

  switch (input.action) {
    case "acknowledge":
      vendorIssueStatus = "acknowledged";
      if (trimmedResponse) {
        data.vendorResponse = trimmedResponse;
        data.vendorRespondedAt = now;
        data.vendorRespondedByUserId = input.userId ?? null;
      }
      break;
    case "respond":
      if (!trimmedResponse) {
        return {
          ok: false,
          code: "RESPONSE_REQUIRED",
          message: "vendorResponse is required for respond action.",
          status: 400,
        };
      }
      data.vendorResponse = trimmedResponse;
      data.vendorRespondedAt = now;
      data.vendorRespondedByUserId = input.userId ?? null;
      vendorIssueStatus =
        existing.vendorIssueStatus === "vendor_reviewed" ||
        existing.vendorIssueStatus === "resolution_requested"
          ? existing.vendorIssueStatus
          : "acknowledged";
      break;
    case "mark_vendor_reviewed":
      vendorIssueStatus = "vendor_reviewed";
      if (trimmedResponse) {
        data.vendorResponse = trimmedResponse;
        data.vendorRespondedAt = now;
        data.vendorRespondedByUserId = input.userId ?? null;
      } else if (!existing.vendorResponse && !existing.vendorRespondedAt) {
        data.vendorRespondedAt = now;
        data.vendorRespondedByUserId = input.userId ?? null;
      }
      break;
    case "request_resolution":
      vendorIssueStatus = "resolution_requested";
      if (trimmedResponse) {
        data.vendorResponse = trimmedResponse;
        data.vendorRespondedAt = now;
        data.vendorRespondedByUserId = input.userId ?? null;
      }
      break;
    default:
      return { ok: false, code: "INVALID_ACTION", message: "Invalid action.", status: 400 };
  }

  if (vendorIssueStatus) {
    data.vendorIssueStatus = vendorIssueStatus;
  }

  await prisma.orderIssue.update({
    where: { id: issueId },
    data,
  });

  const issue = await getVendorOrderIssueForVendor(vendorId, issueId);
  if (!issue) {
    return { ok: false, code: "NOT_FOUND", message: "Issue not found.", status: 404 };
  }
  return { ok: true, issue };
}

export function parseVendorIssueAction(value: unknown): VendorIssueAction | null {
  if (typeof value !== "string") return null;
  return (VENDOR_ISSUE_ACTIONS as readonly string[]).includes(value)
    ? (value as VendorIssueAction)
    : null;
}

export { vendorIssueAccessFilter };
