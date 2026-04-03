/**
 * Transform Mennyu VendorOrder (hydrated) into Deliverect request payload.
 * Maps line items, modifier selections (including nested), item/order notes, and prices.
 * No live API calls; output is ready for future submission.
 *
 * **Money scope:** Line item `price` fields are menu/modifier unit prices only. Order-level
 * `payment.amount` and tax fields must follow {@link deliverectRestaurantFacingPaymentCents} —
 * never include Mennyu’s 3.5% platform service fee (see `deliverect-financial-scope.ts`).
 */
import type {
  DeliverectOrderRequest,
  DeliverectOrderItem,
  DeliverectOrderSubLine,
  DeliverectModifier,
} from "./payloads";
import type { HydratedVendorOrder } from "./load";
import { deliverectRestaurantFacingPaymentCents } from "./deliverect-financial-scope";

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
  const plu = sel.modifierOption.deliverectModifierPlu?.trim();
  if (!plu) {
    const label = sel.modifierOption.name ?? sel.modifierOptionId;
    throw new Error(`Missing Deliverect PLU for modifier option "${label}" (${sel.modifierOptionId})`);
  }
  const externalModifierId = sel.modifierOption.deliverectModifierId?.trim() ?? null;
  return {
    plu,
    ...(externalModifierId ? { externalModifierId } : {}),
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

function selectionIsDeliverectVariantGroup(sel: Selection): boolean {
  return sel.modifierOption.modifierGroup.deliverectIsVariantGroup === true;
}

/** One Deliverect variant step (size / nested variation) — never use `modifiers` for these. */
function selectionToVariantSubLine(sel: Selection): DeliverectOrderSubLine {
  const plu = sel.modifierOption.deliverectModifierPlu?.trim();
  if (!plu) {
    const label = sel.modifierOption.name ?? sel.modifierOptionId;
    throw new Error(`Missing Deliverect PLU for variant option "${label}" (${sel.modifierOptionId})`);
  }
  const externalModifierId = sel.modifierOption.deliverectModifierId?.trim() ?? null;
  return {
    plu,
    name: sel.nameSnapshot,
    quantity: sel.quantity,
    price: Math.round(sel.priceCentsSnapshot),
    ...(externalModifierId ? { externalModifierId } : {}),
  };
}

/**
 * Nest Deliverect variant-group selections (sorted by modifier group order) inside-out:
 * last group = innermost `subItems` node.
 *
 * Deliverect allows at most 3 levels of nested `subItems`; depth is enforced in
 * `validateDeliverectSubItemNesting` and cart validation before submit.
 */
function nestVariantGroupSelections(sels: Selection[]): DeliverectOrderSubLine {
  const sorted = [...sels].sort(
    (a, b) => a.modifierOption.modifierGroup.sortOrder - b.modifierOption.modifierGroup.sortOrder
  );
  const last = sorted[sorted.length - 1]!;
  let node = selectionToVariantSubLine(last);
  for (let i = sorted.length - 2; i >= 0; i--) {
    const outer = selectionToVariantSubLine(sorted[i]!);
    node = { ...outer, subItems: [node] };
  }
  return node;
}

/**
 * Map one Mennyu line item to Deliverect order item.
 * Variant products (`deliverectVariantParentPlu`): top-level parent PLU, price 0, chosen variation + nested variant steps in `subItems`.
 * Deliverect variant groups (`deliverectIsVariantGroup`) emit nested `subItems`, not flat `modifiers`.
 */
function lineItemToDeliverectItem(line: LineItem): DeliverectOrderItem {
  const variationPlu = line.menuItem?.deliverectPlu?.trim();
  if (!variationPlu) {
    const label = line.menuItem?.name ?? line.name;
    throw new Error(`Missing Deliverect PLU for menu item "${label}" (${line.menuItemId})`);
  }
  const itemNote = line.specialInstructions?.trim();

  const variantGroupSels = line.selections.filter(selectionIsDeliverectVariantGroup);
  const modifierSels = line.selections.filter((s) => !selectionIsDeliverectVariantGroup(s));
  const modifierOnly = buildModifiersForLine(modifierSels);

  const parentPlu = line.menuItem?.deliverectVariantParentPlu?.trim();
  const parentName = line.menuItem?.deliverectVariantParentName?.trim();
  const leafExternalId = line.menuItem?.deliverectProductId?.trim() ?? undefined;

  if (parentPlu) {
    const variationSubLine: DeliverectOrderSubLine = {
      plu: variationPlu,
      name: line.name,
      quantity: line.quantity,
      price: Math.round(line.priceCents),
      ...(itemNote ? { remarks: itemNote } : {}),
      ...(leafExternalId ? { externalProductId: leafExternalId } : {}),
    };
    if (variantGroupSels.length > 0) {
      variationSubLine.subItems = [nestVariantGroupSelections(variantGroupSels)];
    }
    if (modifierOnly && modifierOnly.length > 0) {
      variationSubLine.modifiers = modifierOnly;
    }
    return {
      plu: parentPlu,
      name: parentName ?? parentPlu,
      quantity: line.quantity,
      price: 0,
      subItems: [variationSubLine],
    };
  }

  /**
   * Single product row (no `deliverectVariantParentPlu`): shell PLU is the line. Variant-group
   * modifiers (e.g. size on build-your-own) belong in `subItems`, not flat `modifiers` — same as the
   * inner variation node for leaf products, otherwise Deliverect drops or misroutes them.
   */
  const externalProductId = line.menuItem?.deliverectProductId?.trim() ?? null;
  const item: DeliverectOrderItem = {
    plu: variationPlu,
    ...(externalProductId ? { externalProductId } : {}),
    name: line.name,
    quantity: line.quantity,
    price: Math.round(line.priceCents),
    ...(itemNote ? { remark: itemNote, remarks: itemNote } : {}),
  };
  if (variantGroupSels.length > 0) {
    item.subItems = [nestVariantGroupSelections(variantGroupSels)];
  }
  if (modifierOnly && modifierOnly.length > 0) {
    item.modifiers = modifierOnly;
  }
  return item;
}

/**
 * Build Deliverect order request from a hydrated VendorOrder.
 * Prices: sent as integer cents (Deliverect expects integer).
 * Top-level field names match Deliverect API: channelOrderId, channelOrderDisplayId, items, orderType.
 */
/**
 * Deliverect pickup time: UTC instant as `yyyy-MM-ddTHH:mm:ssZ` (no fractional seconds).
 * Customer-scheduled wall time is converted to this instant at order creation (DB stores UTC).
 */
function toDeliverectPickupTimeIso(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * Certification-relevant pickup fields:
 * - `orderType: 1` = pickup.
 * - ASAP: `isASAP: true`, `pickupTime` = now + `preparationTime` minutes (UTC), `preparationTime` = minutes.
 * - Scheduled: `isASAP: false`, `pickupTime` = `order.requestedPickupAt` (UTC), `preparationTime` unchanged from routing.
 */
export function mennyuVendorOrderToDeliverectPayload(input: TransformInput): DeliverectOrderRequest {
  const { vendorOrder } = input;
  const items: DeliverectOrderItem[] = vendorOrder.lineItems.map(lineItemToDeliverectItem);

  const prepMin = input.preparationTimeMinutes ?? 15;
  const scheduledAt = vendorOrder.order.requestedPickupAt;
  const now = Date.now();
  let pickupTime: string;
  let isASAP: boolean;
  if (scheduledAt != null) {
    pickupTime = toDeliverectPickupTimeIso(scheduledAt);
    isASAP = false;
  } else {
    const pickupAt = new Date(now + prepMin * 60 * 1000);
    pickupTime = toDeliverectPickupTimeIso(pickupAt);
    isASAP = true;
  }

  const payload: DeliverectOrderRequest = {
    channelLinkId: input.channelLinkId,
    channelOrderId: vendorOrder.id,
    channelOrderDisplayId: vendorOrder.id,
    items,
    orderType: 1, // pickup
    preparationTime: prepMin,
    pickupTime,
    isASAP,
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
  payload.taxTotal = taxCents;
  payload.taxes = [{ taxClassId: 0, name: "Tax", total: taxCents }];

  /**
   * Prepaid amount for Deliverect: food + restaurant tax + tip for this vendor.
   * Do NOT use `vendorOrder.totalCents` — it includes `serviceFeeCents` (Mennyu 3.5% platform fee).
   */
  const restaurantFacingPaymentCents = deliverectRestaurantFacingPaymentCents({
    subtotalCents: Math.max(0, Math.round(vendorOrder.subtotalCents)),
    taxCents,
    tipCents: Math.max(0, Math.round(vendorOrder.tipCents)),
  });

  /** Stripe checkout completed → treat as pre-paid online in Deliverect. */
  const isStripePaid = Boolean(vendorOrder.order.stripePaymentIntentId);
  payload.decimalDigits = 2;
  payload.orderIsAlreadyPaid = isStripePaid;
  payload.payment = {
    amount: restaurantFacingPaymentCents,
    type: isStripePaid ? 0 : 1,
  };

  return payload;
}
