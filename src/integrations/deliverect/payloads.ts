/**
 * Deliverect API request/response types (placeholder for sandbox).
 * Adjust to actual Deliverect API docs when integrating.
 */

/** Order-level notes (Deliverect order notes). */
export interface DeliverectOrderRequest {
  channelLinkId: string;
  /** External store/location ID when Deliverect requires it. Populate from Vendor.deliverectLocationId. */
  locationId?: string;
  orderId: string; // External reference for Deliverect; we also send mennyuVendorOrderId
  /** Internal Mennyu VendorOrder id for webhook resolution */
  mennyuVendorOrderId?: string;
  orderType?: number; // e.g. takeaway
  preparationTime?: number; // minutes
  orderItems: DeliverectOrderItem[];
  /** Order-level notes. Mapped from Order.orderNotes. */
  orderNotes?: string;
  customerInfo?: {
    phone?: string;
    email?: string;
    name?: string;
  };
}

/** Single line item (product) in the order. */
export interface DeliverectOrderItem {
  /** POS product ID. Placeholder: use Mennyu menuItemId until external product sync. */
  plu: string;
  /** External product ID when Deliverect/POS mapping is available. */
  externalProductId?: string;
  name: string;
  quantity: number;
  /** Unit price in currency units (e.g. USD). Converted from Mennyu priceCents. */
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
  /** Price in currency units. From OrderLineItemSelection.priceCentsSnapshot. */
  price: number;
  remarks?: string;
  /** Nested modifier selections (e.g. "Drizzle" under "Extra cheese"). */
  nestedModifiers?: DeliverectModifier[];
}

export interface DeliverectOrderResponse {
  id?: string; // Deliverect order ID
  success?: boolean;
  error?: string;
  // Add fields per Deliverect API
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
