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

function centsToDecimal(cents: number): number {
  return Math.round(cents) / 100;
}

/**
 * Build one Deliverect modifier from a selection. Prefer external ID when mapped.
 * Nested modifiers are attached by the caller. mennyuOptionId is used for nested grouping only.
 */
function selectionToModifier(sel: Selection): Omit<DeliverectModifier, "nestedModifiers"> & { _mennyuOptionId: string } {
  const externalId = sel.modifierOption.deliverectModifierId ?? null;
  return {
    plu: externalId ?? sel.modifierOptionId,
    ...(externalId ? { externalModifierId: externalId } : {}),
    name: sel.nameSnapshot,
    quantity: sel.quantity,
    price: centsToDecimal(sel.priceCentsSnapshot),
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
 */
function lineItemToDeliverectItem(line: LineItem): DeliverectOrderItem {
  const modifiers = buildModifiersForLine(line.selections);
  const externalProductId = line.menuItem?.deliverectProductId ?? null;
  return {
    plu: externalProductId ?? line.menuItemId,
    ...(externalProductId ? { externalProductId } : {}),
    name: line.name,
    quantity: line.quantity,
    price: centsToDecimal(line.priceCents),
    remarks: line.specialInstructions ?? undefined,
    ...(modifiers && modifiers.length > 0 ? { modifiers } : {}),
  };
}

/**
 * Build Deliverect order request from a hydrated VendorOrder.
 * Prices: stored in cents internally; converted to decimal for payload.
 */
export function mennyuVendorOrderToDeliverectPayload(input: TransformInput): DeliverectOrderRequest {
  const { vendorOrder } = input;
  const orderItems: DeliverectOrderItem[] = vendorOrder.lineItems.map(lineItemToDeliverectItem);

  const payload: DeliverectOrderRequest = {
    channelLinkId: input.channelLinkId,
    orderId: vendorOrder.id,
    mennyuVendorOrderId: vendorOrder.id,
    orderItems,
    preparationTime: input.preparationTimeMinutes ?? 15,
  };

  if (vendorOrder.order.orderNotes) {
    payload.orderNotes = vendorOrder.order.orderNotes;
  }
  if (input.locationId) payload.locationId = input.locationId;
  if (input.customerPhone || input.customerEmail) {
    payload.customerInfo = {
      phone: input.customerPhone,
      email: input.customerEmail ?? undefined,
    };
  }

  return payload;
}
