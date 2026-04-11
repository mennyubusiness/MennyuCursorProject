import type { getOrderStatusAction } from "@/actions/order.actions";

type OrderFromApi = NonNullable<Awaited<ReturnType<typeof getOrderStatusAction>>>;

/**
 * Merge a slim poll payload (no line items) into the previous full order so the status page keeps
 * stable line-item rows while live fields update.
 */
export function mergeCustomerOrderPollPatch(prev: OrderFromApi, patch: OrderFromApi): OrderFromApi {
  const prevVoById = new Map(prev.vendorOrders.map((v) => [v.id, v]));
  const vendorOrders = patch.vendorOrders.map((pvo) => {
    const existing = prevVoById.get(pvo.id);
    if (!existing) {
      return pvo;
    }
    const lineItems =
      pvo.lineItems && pvo.lineItems.length > 0 ? pvo.lineItems : existing.lineItems;
    return {
      ...existing,
      ...pvo,
      lineItems,
      vendor: { ...existing.vendor, ...pvo.vendor },
    };
  });
  return {
    ...prev,
    ...patch,
    vendorOrders,
  };
}
