/**
 * Deliverect API request/response types (placeholder for sandbox).
 * Adjust to actual Deliverect API docs when integrating.
 */

/** Deliverect create-order request (top-level fields per API validation). */
export interface DeliverectOrderRequest {
  channelLinkId: string;
  /** Channel’s order id (required). We use Mennyu vendor order id. */
  channelOrderId: string;
  /** Human-readable order reference for display (required). We use vendor order id. */
  channelOrderDisplayId: string;
  /** Line items (required). API expects "items". */
  items: DeliverectOrderItem[];
  /** Order type: 1=pickup, 2=delivery, 3=eat-in, 4=curbside (required). */
  orderType: number;
  /** External store/location ID when Deliverect requires it. Populate from Vendor.deliverectLocationId. */
  locationId?: string;
  preparationTime?: number; // minutes
  /** ISO8601 UTC (e.g. 2020-03-09T17:17:38Z). Drives Deliverect Orders tab date range. */
  pickupTime?: string;
  /** When true, order treated as ASAP (Deliverect docs: use if pickup within ~30m). */
  isASAP?: boolean;
  /** Order-level notes (legacy/alternate key some stacks accept). */
  orderNotes?: string;
  /** Deliverect channel API: order-level note parameter name. */
  note?: string;
  /**
   * Deliverect channel API customer block (`phoneNumber`, not `phone`).
   * See https://developers.deliverect.com/page/channel-orders
   */
  customer?: {
    name?: string;
    phoneNumber?: string;
    email?: string;
    companyName?: string;
    note?: string;
  };
  /** @deprecated Prefer `customer` — Deliverect expects `customer.phoneNumber`. */
  customerInfo?: {
    phone?: string;
    email?: string;
    name?: string;
  };
  /** Total tax in minor units (vendor-order tax allocation). */
  taxTotal?: number;
  /** Tax-exclusive: required line items; one entry minimum (total may be 0). */
  taxes?: Array<{ taxClassId: number; name: string; total: number }>;
  /** Minor units per major currency unit (e.g. 2 for cents). */
  decimalDigits?: number;
  /** When true, order is pre-paid online (Deliverect shows paid). */
  orderIsAlreadyPaid?: boolean;
  /** Total in minor units; type 0 = card/online paid, 1 = cash / pay at pickup. */
  payment?: { amount: number; type: number };
}

/** Single line item (product) in the order. */
export interface DeliverectOrderItem {
  /** POS product ID. Placeholder: use Mennyu menuItemId until external product sync. */
  plu: string;
  /** External product ID when Deliverect/POS mapping is available. */
  externalProductId?: string;
  name: string;
  quantity: number;
  /** Unit price in integer cents (minor units). From Mennyu priceCents. */
  price: number;
  /** Item-level notes (Deliverect item notes). Mapped from OrderLineItem.specialInstructions. */
  remarks?: string;
  /** Modifier selections for this line (top-level and nested). */
  modifiers?: DeliverectModifier[];
}

/** Single modifier selection. Supports nested modifiers for options that have sub-choices. */
export interface DeliverectModifier {
  /** POS modifier ID. Placeholder: use Mennyu modifierOptionId until external mapping. */
  plu: string;
  /** External modifier ID when Deliverect/POS mapping is available. */
  externalModifierId?: string;
  name: string;
  quantity: number;
  /** Price in integer cents (minor units). From OrderLineItemSelection.priceCentsSnapshot. */
  price: number;
  /** Modifier-level note when present (Deliverect `subItems` use same item shape as `remark`). */
  remark?: string;
  remarks?: string;
  /** Nested modifier selections (e.g. "Drizzle" under "Extra cheese"). */
  nestedModifiers?: DeliverectModifier[];
}

export interface DeliverectOrderResponse {
  id?: string;
  _id?: string;
  orderId?: string;
  success?: boolean;
  error?: string;
  [key: string]: unknown;
}

export interface DeliverectWebhookPayload {
  eventType?: string;
  orderId?: string; // May be Deliverect's external id or echo of our reference
  /** Internal Mennyu VendorOrder id; prefer this for resolution */
  mennyuVendorOrderId?: string;
  deliverectOrderId?: string; // External ID from Deliverect
  channelLinkId?: string;
  status?: string;
  [key: string]: unknown;
}
