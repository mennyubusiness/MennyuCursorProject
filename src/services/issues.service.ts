/**
 * Order / VendorOrder issue tracking.
 * Operational issues only; does not change order lifecycle or status.
 */
import { prisma } from "@/lib/db";

export type IssueSeverity = "LOW" | "MEDIUM" | "HIGH";
export type IssueStatus = "OPEN" | "RESOLVED";

export type OrderIssueType =
  | "routing_failure"
  | "vendor_cancelled"
  | "delayed_vendor"
  | "partial_order"
  | "manual_refund"
  | "customer_issue"
  | "order_dispute";

export type VendorOrderIssueType =
  | "routing_failure"
  | "vendor_cancelled"
  | "delayed_vendor"
  | "partial_order"
  | "manual_recovery"
  | "customer_issue"
  | "order_dispute";

export async function createOrderIssue(
  orderId: string,
  type: OrderIssueType,
  severity: IssueSeverity,
  options?: { notes?: string; createdBy?: string }
) {
  return prisma.orderIssue.create({
    data: {
      orderId,
      type,
      severity,
      status: "OPEN",
      notes: options?.notes ?? null,
      createdBy: options?.createdBy ?? null,
    },
  });
}

export async function createVendorOrderIssue(
  vendorOrderId: string,
  type: VendorOrderIssueType,
  severity: IssueSeverity,
  options?: { notes?: string; createdBy?: string }
) {
  return prisma.vendorOrderIssue.create({
    data: {
      vendorOrderId,
      type,
      severity,
      status: "OPEN",
      notes: options?.notes ?? null,
      createdBy: options?.createdBy ?? null,
    },
  });
}

export async function resolveOrderIssue(
  issueId: string,
  options?: { resolvedBy?: string }
) {
  return prisma.orderIssue.update({
    where: { id: issueId },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
      resolvedBy: options?.resolvedBy ?? null,
    },
  });
}

export async function resolveVendorOrderIssue(
  issueId: string,
  options?: { resolvedBy?: string }
) {
  return prisma.vendorOrderIssue.update({
    where: { id: issueId },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
      resolvedBy: options?.resolvedBy ?? null,
    },
  });
}

export async function getOrderIssues(orderId: string, status?: IssueStatus) {
  return prisma.orderIssue.findMany({
    where: { orderId, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
  });
}

export async function getVendorOrderIssues(
  vendorOrderId: string,
  status?: IssueStatus
) {
  return prisma.vendorOrderIssue.findMany({
    where: { vendorOrderId, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateOrderIssueNotes(issueId: string, notes: string | null) {
  return prisma.orderIssue.update({
    where: { id: issueId },
    data: { notes },
  });
}

export async function updateVendorOrderIssueNotes(issueId: string, notes: string | null) {
  return prisma.vendorOrderIssue.update({
    where: { id: issueId },
    data: { notes },
  });
}

/** Get all order IDs that have at least one open OrderIssue or open VendorOrderIssue. */
export async function getOrderIdsWithOpenIssues(): Promise<string[]> {
  const [orderIssues, voIssues] = await Promise.all([
    prisma.orderIssue.findMany({
      where: { status: "OPEN" },
      select: { orderId: true },
    }),
    prisma.vendorOrderIssue.findMany({
      where: { status: "OPEN" },
      select: { vendorOrder: { select: { orderId: true } } },
    }),
  ]);
  const fromOrder = orderIssues.map((i) => i.orderId);
  const fromVo = voIssues.map((i) => i.vendorOrder.orderId);
  return [...new Set([...fromOrder, ...fromVo])];
}
