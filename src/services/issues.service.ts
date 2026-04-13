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

/** Read-only admin history: resolved OrderIssue + VendorOrderIssue rows (for Issues page “Resolved” tab). */
export type AdminResolvedIssueHistoryRow = {
  id: string;
  kind: "order_issue" | "vendor_order_issue";
  orderId: string;
  resolvedAt: string;
  type: string;
  severity: string;
  notes: string | null;
  podName: string | null;
  podId: string | null;
  vendorName: string | null;
};

export async function getAdminResolvedIssueHistory(maxRows: number): Promise<AdminResolvedIssueHistoryRow[]> {
  const chunk = Math.min(200, Math.ceil(maxRows / 2) + 25);
  const [orderRows, voRows] = await Promise.all([
    prisma.orderIssue.findMany({
      where: { status: "RESOLVED", resolvedAt: { not: null } },
      orderBy: { resolvedAt: "desc" },
      take: chunk,
      select: {
        id: true,
        orderId: true,
        type: true,
        severity: true,
        notes: true,
        resolvedAt: true,
        order: { select: { pod: { select: { id: true, name: true } } } },
      },
    }),
    prisma.vendorOrderIssue.findMany({
      where: { status: "RESOLVED", resolvedAt: { not: null } },
      orderBy: { resolvedAt: "desc" },
      take: chunk,
      select: {
        id: true,
        type: true,
        severity: true,
        notes: true,
        resolvedAt: true,
        vendorOrder: {
          select: {
            orderId: true,
            vendor: { select: { name: true } },
            order: { select: { pod: { select: { id: true, name: true } } } },
          },
        },
      },
    }),
  ]);

  const fromOrder: AdminResolvedIssueHistoryRow[] = orderRows.map((r) => ({
    id: r.id,
    kind: "order_issue",
    orderId: r.orderId,
    resolvedAt: r.resolvedAt!.toISOString(),
    type: r.type,
    severity: r.severity,
    notes: r.notes,
    podName: r.order.pod?.name ?? null,
    podId: r.order.pod?.id ?? null,
    vendorName: null,
  }));

  const fromVo: AdminResolvedIssueHistoryRow[] = voRows.map((r) => ({
    id: r.id,
    kind: "vendor_order_issue",
    orderId: r.vendorOrder.orderId,
    resolvedAt: r.resolvedAt!.toISOString(),
    type: r.type,
    severity: r.severity,
    notes: r.notes,
    podName: r.vendorOrder.order?.pod?.name ?? null,
    podId: r.vendorOrder.order?.pod?.id ?? null,
    vendorName: r.vendorOrder.vendor?.name ?? null,
  }));

  return [...fromOrder, ...fromVo]
    .sort((a, b) => new Date(b.resolvedAt).getTime() - new Date(a.resolvedAt).getTime())
    .slice(0, maxRows);
}
