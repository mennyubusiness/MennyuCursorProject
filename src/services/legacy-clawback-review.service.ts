import { prisma } from "@/lib/db";
import {
  isLegacyClawbackReviewClosed,
  type LegacyClawbackReviewStatus,
} from "@/lib/legacy-clawback-review";

export class LegacyClawbackReviewError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "INVALID_STATUS" | "NOTE_REQUIRED" | "NOT_LEGACY_CASE"
  ) {
    super(message);
    this.name = "LegacyClawbackReviewError";
  }
}

export type MarkLegacyClawbackReviewInput = {
  vendorPayoutTransferId: string;
  status: LegacyClawbackReviewStatus;
  note: string;
  reviewedBy?: string;
};

export type MarkLegacyClawbackReviewResult = {
  vendorPayoutTransferId: string;
  orderId: string;
  vendorOrderId: string;
  status: LegacyClawbackReviewStatus;
  reviewedAt: string;
  note: string;
};

export async function markLegacyClawbackReview(
  input: MarkLegacyClawbackReviewInput
): Promise<MarkLegacyClawbackReviewResult> {
  const note = input.note.trim();
  if (!note) {
    throw new LegacyClawbackReviewError("An admin note is required.", "NOTE_REQUIRED");
  }
  if (input.status !== "reviewed" && input.status !== "deferred") {
    throw new LegacyClawbackReviewError("Invalid review status.", "INVALID_STATUS");
  }

  const vpt = await prisma.vendorPayoutTransfer.findUnique({
    where: { id: input.vendorPayoutTransferId },
    select: {
      id: true,
      status: true,
      stripeTransferId: true,
      legacyClawbackReviewStatus: true,
      vendorOrder: { select: { id: true, orderId: true } },
    },
  });
  if (!vpt?.vendorOrder) {
    throw new LegacyClawbackReviewError("Vendor payout transfer not found.", "NOT_FOUND");
  }
  if (vpt.status !== "paid" || !vpt.stripeTransferId?.trim()) {
    throw new LegacyClawbackReviewError(
      "Only paid Connect transfers can be marked for legacy clawback review.",
      "NOT_LEGACY_CASE"
    );
  }

  const reviewedAt = new Date();
  await prisma.vendorPayoutTransfer.update({
    where: { id: vpt.id },
    data: {
      legacyClawbackReviewStatus: input.status,
      legacyClawbackReviewNote: note,
      legacyClawbackReviewedAt: reviewedAt,
      legacyClawbackReviewedBy: input.reviewedBy ?? "admin",
    },
  });

  return {
    vendorPayoutTransferId: vpt.id,
    orderId: vpt.vendorOrder.orderId,
    vendorOrderId: vpt.vendorOrder.id,
    status: input.status,
    reviewedAt: reviewedAt.toISOString(),
    note,
  };
}

export type AdminLegacyClawbackReviewHistoryRow = {
  id: string;
  kind: "legacy_clawback_review";
  orderId: string;
  vendorOrderId: string;
  vendorName: string | null;
  podName: string | null;
  podId: string | null;
  status: LegacyClawbackReviewStatus;
  notes: string;
  resolvedAt: string;
  stripeTransferId: string | null;
  transferAmountCents: number;
};

export async function getAdminLegacyClawbackReviewHistory(
  maxRows: number
): Promise<AdminLegacyClawbackReviewHistoryRow[]> {
  const rows = await prisma.vendorPayoutTransfer.findMany({
    where: {
      legacyClawbackReviewStatus: { in: ["reviewed", "deferred"] },
      legacyClawbackReviewedAt: { not: null },
    },
    orderBy: { legacyClawbackReviewedAt: "desc" },
    take: maxRows,
    select: {
      id: true,
      amountCents: true,
      stripeTransferId: true,
      legacyClawbackReviewStatus: true,
      legacyClawbackReviewNote: true,
      legacyClawbackReviewedAt: true,
      vendorOrder: {
        select: {
          id: true,
          orderId: true,
          vendor: { select: { name: true } },
          order: { select: { pod: { select: { id: true, name: true } } } },
        },
      },
    },
  });

  return rows
    .filter(
      (r): r is typeof r & { legacyClawbackReviewStatus: LegacyClawbackReviewStatus; legacyClawbackReviewedAt: Date } =>
        isLegacyClawbackReviewClosed(r.legacyClawbackReviewStatus) &&
        r.legacyClawbackReviewedAt != null
    )
    .map((r) => ({
      id: r.id,
      kind: "legacy_clawback_review" as const,
      orderId: r.vendorOrder.orderId,
      vendorOrderId: r.vendorOrder.id,
      vendorName: r.vendorOrder.vendor?.name ?? null,
      podName: r.vendorOrder.order.pod?.name ?? null,
      podId: r.vendorOrder.order.pod?.id ?? null,
      status: r.legacyClawbackReviewStatus,
      notes: r.legacyClawbackReviewNote ?? "",
      resolvedAt: r.legacyClawbackReviewedAt.toISOString(),
      stripeTransferId: r.stripeTransferId,
      transferAmountCents: r.amountCents,
    }));
}
