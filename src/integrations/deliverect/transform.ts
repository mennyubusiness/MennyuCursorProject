/**
 * Transform Mennyu VendorOrder (hydrated) into Deliverect request payload.
 * Maps line items, modifier selections (including nested), item/order notes, and prices.
 * No live API calls; output is ready for future submission.
 */
import type {
  DeliverectOrderRequest,
  DeliverectOrderItem,
  DeliverectModifier,
} from "./payloads";
import type { HydratedVendorOrder } from "./load";

export interface TransformInput {
  /** Fully loaded VendorOrder from getVendorOrderForDeliverect. */
  vendorOrder: NonNullable<HydratedVendorOrder>;
  channelLinkId: string;
  /** External store/location ID. Populate from Vendor.deliverectLocationId when available. */
  locationId?: string;
  customerPhone?: string;
  customerEmail?: string | null;
  preparationTimeMinutes?: number;
}

type LineItem = NonNullable<HydratedVendorOrder>["lineItems"][number];
type Selection = LineItem["selections"][number];

/**
 * Build one Deliverect modifier from a selection. Prefer external ID when mapped.
 * Nested modifiers are attached by the caller. mennyuOptionId is used for nested grouping only.
 * Price: integer cents (Deliverect expects integer).
 */
function selectionToModifier(sel: Selection): Omit<DeliverectModifier, "nestedModifiers"> & { _mennyuOptionId: string } {
  const externalId = sel.modifierOption.deliverectModifierId ?? null;
  return {
    plu: externalId ?? sel.modifierOptionId,
    ...(externalId ? { externalModifierId: externalId } : {}),
    name: sel.nameSnapshot,
    quantity: sel.quantity,
    price: Math.round(sel.priceCentsSnapshot),
    _mennyuOptionId: sel.modifierOptionId,
  };
}

/**
 * Build modifier list for a line item with nested structure.
 * Top-level = selection whose modifierGroup.parentModifierOptionId is null.
 * Nested = selection whose modifierGroup.parentModifierOptionId points to another option in this line; attached under that option.
 */
function buildModifiersForLine(selections: Selection[]): DeliverectModifier[] | undefined {
  if (selections.length === 0) return undefined;

  type ModifierWithInternalId = Omit<DeliverectModifier, "nestedModifiers"> & {
    _mennyuOptionId: string;
    nestedModifiers?: DeliverectModifier[] | undefined;
  };
  const topLevel: ModifierWithInternalId[] = [];
  const byParentId = new Map<string, Selection[]>();

  for (const sel of selections) {
    const parentId = sel.modifierOption.modifierGroup.parentModifierOptionId ?? null;
    if (parentId == null) {
      const m = selectionToModifier(sel);
      topLevel.push({ ...m, nestedModifiers: undefined });
    } else {
      const list = byParentId.get(parentId) ?? [];
      list.push(sel);
      byParentId.set(parentId, list);
    }
  }

  function attachNested(
    raw: Omit<DeliverectModifier, "nestedModifiers"> & { _mennyuOptionId: string }
  ): DeliverectModifier {
    const { _mennyuOptionId, ...mod } = raw;
    const nestedSels = byParentId.get(_mennyuOptionId);
    if (!nestedSels?.length) return mod as DeliverectModifier;
    return {
      ...mod,
      nestedModifiers: nestedSels.map((s) => attachNested(selectionToModifier(s))),
    } as DeliverectModifier;
  }

  return topLevel.map((m) => attachNested(m));
}

/**
 * Map one Mennyu line item to Deliverect order item. Prefer external product ID when mapped.
 * Price: integer cents (Deliverect expects integer).
 */
function lineItemToDeliverectItem(line: LineItem): DeliverectOrderItem {
  const modifiers = buildModifiersForLine(line.selections);
  const externalProductId = line.menuItem?.deliverectProductId ?? null;
  const itemNote = line.specialInstructions?.trim();
  return {
    plu: externalProductId ?? line.menuItemId,
    ...(externalProductId ? { externalProductId } : {}),
    name: line.name,
    quantity: line.quantity,
    price: Math.round(line.priceCents),
    ...(itemNote ? { remark: itemNote, remarks: itemNote } : {}),
    ...(modifiers && modifiers.length > 0 ? { modifiers } : {}),
  };
}

/**
 * Build Deliverect order request from a hydrated VendorOrder.
 * Prices: sent as integer cents (Deliverect expects integer).
 * Top-level field names match Deliverect API: channelOrderId, channelOrderDisplayId, items, orderType.
 */
export function mennyuVendorOrderToDeliverectPayload(input: TransformInput): DeliverectOrderRequest {
  const { vendorOrder } = input;
  const items: DeliverectOrderItem[] = vendorOrder.lineItems.map(lineItemToDeliverectItem);

  const prepMin = input.preparationTimeMinutes ?? 15;
  const pickupAt = new Date(Date.now() + prepMin * 60 * 1000);
  /** Deliverect sample format without ms: yyyy-MM-ddTHH:mm:ssZ */
  const pickupTime = pickupAt.toISOString().replace(/\.\d{3}Z$/, "Z");

  const payload: DeliverectOrderRequest = {
    channelLinkId: input.channelLinkId,
    channelOrderId: vendorOrder.id,
    channelOrderDisplayId: vendorOrder.id,
    items,
    orderType: 1, // pickup
    preparationTime: prepMin,
    pickupTime,
    isASAP: prepMin <= 30,
  };

  const orderNote = vendorOrder.order.orderNotes?.trim();
  if (orderNote) {
    payload.note = orderNote;
    payload.orderNotes = orderNote;
  }
  if (input.locationId) payload.locationId = input.locationId;

  /** Deliverect channel API expects `customer.phoneNumber`, not `customerInfo.phone`. */
  const phoneNumber =
    input.customerPhone?.trim() || vendorOrder.order.customerPhone?.trim() || undefined;
  const email =
    (input.customerEmail ?? vendorOrder.order.customerEmail)?.trim() || undefined;
  if (phoneNumber || email) {
    payload.customer = {
      ...(phoneNumber ? { phoneNumber } : {}),
      ...(email ? { email } : {}),
    };
  }

  const taxCents = Math.max(0, Math.round(vendorOrder.taxCents));
  const totalCents = Math.max(0, Math.round(vendorOrder.totalCents));
  payload.taxTotal = taxCents;
  payload.taxes = [{ taxClassId: 0, name: "Tax", total: taxCents }];

  /** Stripe checkout completed → treat as pre-paid online in Deliverect. */
  const isStripePaid = Boolean(vendorOrder.order.stripePaymentIntentId);
  payload.decimalDigits = 2;
  payload.orderIsAlreadyPaid = isStripePaid;
  payload.payment = {
    amount: totalCents,
    type: isStripePaid ? 0 : 1,
  };

  return payload;
}
