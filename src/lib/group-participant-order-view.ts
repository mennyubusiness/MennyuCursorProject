/**
 * Customer-facing order payload filtered for group order participants (read-only, privacy-safe).
 */

type LineItemLike = {
  id: string;
  name: string;
  quantity: number;
  priceCents: number;
  groupOrderParticipantId?: string | null;
  selections?: Array<{ id: string; nameSnapshot: string; quantity: number }>;
};

type VendorOrderLike = {
  id: string;
  vendor: { id: string; name: string };
  totalCents: number;
  routingStatus: string;
  fulfillmentStatus: string;
  statusHistory?: unknown[];
  lineItems: LineItemLike[];
  [key: string]: unknown;
};

type OrderLike = {
  vendorOrders: VendorOrderLike[];
  refundAttempts?: unknown[];
  orderRefunds?: unknown[];
  subtotalCents?: number;
  serviceFeeCents?: number;
  taxCents?: number | null;
  tipCents?: number;
  totalCents?: number;
  totalRefundedCents?: number | null;
  issues?: unknown[];
  [key: string]: unknown;
};

export type ParticipantOrderViewMeta = {
  participantSubtotalCents: number;
  hasOtherGroupItems: boolean;
};

function lineBelongsToParticipant(
  line: LineItemLike,
  participantId: string,
  hostParticipantId: string | null
): boolean {
  if (line.groupOrderParticipantId != null) {
    return line.groupOrderParticipantId === participantId;
  }
  return hostParticipantId != null && hostParticipantId === participantId;
}

/** Filter order graph to participant-visible lines; strip payment/refund/issue payloads. */
export function filterOrderForGroupParticipantView<T extends OrderLike>(
  order: T,
  participantId: string,
  hostParticipantId: string | null
): T & ParticipantOrderViewMeta {
  let participantSubtotalCents = 0;
  let hasOtherGroupItems = false;

  const vendorOrders = order.vendorOrders.map((vo) => {
    const ownLines: LineItemLike[] = [];
    for (const line of vo.lineItems ?? []) {
      if (lineBelongsToParticipant(line, participantId, hostParticipantId)) {
        ownLines.push(line);
        participantSubtotalCents += line.priceCents * line.quantity;
      } else {
        hasOtherGroupItems = true;
      }
    }
    const ownSubtotal = ownLines.reduce((sum, l) => sum + l.priceCents * l.quantity, 0);
    return {
      ...vo,
      lineItems: ownLines,
      totalCents: ownSubtotal,
    };
  });

  return {
    ...order,
    vendorOrders,
    refundAttempts: [],
    orderRefunds: [],
    issues: [],
    participantSubtotalCents,
    hasOtherGroupItems,
  };
}
