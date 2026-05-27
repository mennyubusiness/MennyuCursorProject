/**
 * Prior refunded quantity/amount for line-item refunds (committed ledger rows only).
 */
import { prisma } from "@/lib/db";
import { COMMITTED_ORDER_REFUND_STATUSES } from "@/domain/order-refund";

export async function getCommittedRefundedQuantityForLineItem(
  orderLineItemId: string
): Promise<number> {
  const rows = await prisma.refundLineItem.findMany({
    where: {
      orderLineItemId,
      orderRefund: { status: { in: [...COMMITTED_ORDER_REFUND_STATUSES] } },
    },
    select: { quantityRefunded: true },
  });
  return rows.reduce((sum, row) => sum + (row.quantityRefunded ?? 0), 0);
}

export function computeLineItemRefundComponents(input: {
  priceCents: number;
  purchasedQuantity: number;
  refundQuantity: number;
  vendorSubtotalCents: number;
  vendorTaxCents: number;
  vendorTipCents: number;
  vendorServiceFeeCents: number;
  includeTax: boolean;
  includeTip: boolean;
  includeServiceFee: boolean;
}): {
  subtotalRefundedCents: number;
  taxRefundedCents: number;
  tipRefundedCents: number;
  serviceFeeRefundedCents: number;
  amountCents: number;
} {
  const lineSubtotalForRefund = input.priceCents * input.refundQuantity;
  const lineSubtotalTotal = input.priceCents * input.purchasedQuantity;

  const ratio =
    input.vendorSubtotalCents > 0
      ? lineSubtotalForRefund / input.vendorSubtotalCents
      : lineSubtotalTotal > 0
        ? lineSubtotalForRefund / lineSubtotalTotal
        : 0;

  const subtotalRefundedCents = lineSubtotalForRefund;
  const taxRefundedCents = input.includeTax
    ? Math.round(input.vendorTaxCents * ratio)
    : 0;
  const tipRefundedCents = input.includeTip
    ? Math.round(input.vendorTipCents * ratio)
    : 0;
  const serviceFeeRefundedCents = input.includeServiceFee
    ? Math.round(input.vendorServiceFeeCents * ratio)
    : 0;
  const amountCents =
    subtotalRefundedCents +
    taxRefundedCents +
    tipRefundedCents +
    serviceFeeRefundedCents;

  return {
    subtotalRefundedCents,
    taxRefundedCents,
    tipRefundedCents,
    serviceFeeRefundedCents,
    amountCents,
  };
}
