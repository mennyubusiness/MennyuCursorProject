/**
 * Mennyu core domain types.
 * All money in cents (integer). IDs are string (cuid).
 */

// ---- Enums (match DB and state machine) ----
export const PARENT_ORDER_STATUS = [
  "pending_payment",
  "paid",
  "routing",
  "routed_partial",
  "routed",
  "accepted",
  "preparing",
  "ready",
  "in_progress",
  "partially_completed",
  "completed",
  "cancelled",
  "failed",
] as const;
export type ParentOrderStatus = (typeof PARENT_ORDER_STATUS)[number];

export const VENDOR_ORDER_ROUTING_STATUS = ["pending", "sent", "confirmed", "failed"] as const;
export type VendorOrderRoutingStatus = (typeof VENDOR_ORDER_ROUTING_STATUS)[number];

export const VENDOR_ORDER_FULFILLMENT_STATUS = [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "completed",
  "cancelled",
] as const;
export type VendorOrderFulfillmentStatus = (typeof VENDOR_ORDER_FULFILLMENT_STATUS)[number];

// ---- Pod ----
export interface Pod {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  isActive: boolean;
}

export interface PodWithVendors extends Pod {
  vendors: VendorInPod[];
}

export interface VendorInPod {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
}

// ---- Vendor ----
export interface Vendor {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
  deliverectChannelLinkId: string | null;
  deliverectLocationId: string | null;
  deliverectAccountId: string | null;
}

// ---- Menu ----
export interface MenuItem {
  id: string;
  vendorId: string;
  name: string;
  description: string | null;
  priceCents: number;
  imageUrl: string | null;
  sortOrder: number;
  isAvailable: boolean;
}

// ---- Cart (session + pod scoped) ----
/** Structured modifier selection (Deliverect-compliant). Optional until UI uses it. */
export interface CartItemSelection {
  modifierOptionId: string;
  modifierOptionName: string;
  priceCents: number;
  quantity: number;
}

export interface CartItem {
  id: string;
  menuItemId: string;
  vendorId: string;
  quantity: number;
  priceCents: number;
  specialInstructions: string | null;
  menuItem?: {
    name: string;
    /** Parent shell PLU when this line is a Deliverect variant leaf row. */
    deliverectPlu?: string | null;
    deliverectVariantParentPlu?: string | null;
  };
  /** Present when cart item has modifier selections (e.g. from future modifier UI). */
  selections?: CartItemSelection[];
}

export interface CartGroup {
  vendorId: string;
  vendorName: string;
  items: CartItem[];
  subtotalCents: number;
}

/** How the customer cart relates to a pod (browsing ≠ assigned). */
export type CartPodScope = "neutral" | "browsing_pod" | "assigned_pod" | "group_order";

/** Display-safe active cart hint for Quick Cart recovery (never includes joinToken). */
export type ActiveCartRecovery = {
  kind: "solo_cart" | "group_host" | "group_participant";
  cartId: string;
  podId: string;
  podName: string;
  itemCount?: number;
  subtotalCents?: number;
  /** Host only — 6-digit invite code. */
  groupCode?: string;
  /** Host only — active participants in session. */
  participantCount?: number;
  /** Host only — public join link target. */
  groupOrderSessionId?: string;
  isCurrentContext: boolean;
  isConflictingWithBrowsePod: boolean;
};

/** GET /api/cart quick-cart payload (not used for cartId mutations). */
export type QuickCartApiResponse = {
  scope: CartPodScope;
  cart: Cart | null;
  browsingPodId: string | null;
  browsingPodName: string | null;
  assignedPodId: string | null;
  assignedPodName: string | null;
  requiresClearToSwitchPod: boolean;
  activeCartRecovery?: ActiveCartRecovery | null;
};

/** Client-safe group-order summary on cart API responses (never includes joinToken). */
export type CartGroupOrderDisplay = {
  role: "solo" | "host" | "participant" | "unknown";
  canCheckout: boolean;
  /** Present for host when a group session is active. */
  joinCode?: string;
  /** Present for host — used for invite link (`/group-order/join?session=…`). */
  groupOrderSessionId?: string;
};

export interface Cart {
  id: string;
  podId: string;
  sessionId: string;
  items: CartItem[];
  groups: CartGroup[];
  subtotalCents: number;
  /** Pod display name when known (Quick Cart / API). */
  podName?: string | null;
  /** Group-order role and host invite metadata for customer UI. */
  groupOrder?: CartGroupOrderDisplay;
  /** Pod scope for Quick Cart / display (from server). */
  cartScope?: CartPodScope;
}

// ---- Order (parent) ----
export interface Order {
  id: string;
  podId: string;
  customerPhone: string;
  customerEmail: string | null;
  orderNotes: string | null;
  subtotalCents: number;
  serviceFeeCents: number;
  tipCents: number;
  taxCents: number;
  totalCents: number;
  status: ParentOrderStatus;
  stripePaymentIntentId: string | null;
  /** Customer-chosen scheduled pickup instant (UTC). Null = ASAP at checkout. */
  requestedPickupAt: Date | null;
  /** Deliverect prep-time / kitchen ETA (UTC). Not customer schedule intent. */
  deliverectEstimatedReadyAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderWithVendorOrders extends Order {
  vendorOrders: VendorOrder[];
}

// ---- Vendor order (child) ----
export interface VendorOrder {
  id: string;
  orderId: string;
  vendorId: string;
  subtotalCents: number;
  tipCents: number;
  taxCents: number;
  serviceFeeCents: number;
  totalCents: number;
  /** Pass-through processing recovery on vendor food subtotal (tips not included in base). */
  vendorProcessingFeeRecoveryCents: number;
  deliverectOrderId: string | null;
  deliverectChannelLinkId: string | null;
  routingStatus: VendorOrderRoutingStatus;
  fulfillmentStatus: VendorOrderFulfillmentStatus;
  deliverectAttempts: number;
  lineItems?: OrderLineItem[];
  vendor?: { name: string };
}

export interface OrderLineItem {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  priceCents: number;
  specialInstructions: string | null;
}

// ---- Payment allocation (per vendor from single payment) ----
export interface PaymentAllocation {
  paymentId: string;
  vendorOrderId: string;
  subtotalCents: number;
  tipCents: number;
  taxCents: number;
  serviceFeeCents: number;
  totalCents: number;
  /** Snapshot at payment: subtotal + tax + tip (excludes Mennyu service fee). */
  grossVendorPayableCents?: number;
  allocatedProcessingFeeCents?: number;
  netVendorTransferCents?: number;
}

// ---- Status history ----
export interface OrderStatusHistoryEntry {
  id: string;
  orderId: string;
  status: string;
  source: string | null;
  note: string | null;
  createdAt: Date;
}

export interface VendorOrderStatusHistoryEntry {
  id: string;
  vendorOrderId: string;
  routingStatus: string | null;
  fulfillmentStatus: string | null;
  source: string | null;
  rawPayload: unknown;
  createdAt: Date;
}

// ---- Checkout input ----
export type CheckoutPickupMode = "asap" | "scheduled";

export interface CheckoutInput {
  cartId: string;
  customerPhone: string;
  customerEmail?: string;
  orderNotes?: string | null;
  tipCents: number;
  idempotencyKey: string;
  pickupMode?: CheckoutPickupMode;
  /** Required when pickupMode is `scheduled` (YYYY-MM-DD in pod timezone). */
  scheduledPickupDate?: string;
  /** Required when pickupMode is `scheduled` (HH:mm, 24h, in pod timezone). */
  scheduledPickupTime?: string;
  /** When the cart is a group order, must be the host user id (verified in checkout API). */
  groupOrderHostUserId?: string | null;
  /** Server-derived group cart snapshot from checkout lock; required for group-order checkout. */
  groupCheckoutFingerprint?: string | null;
  /** Mennyu anonymous session id — required for solo-cart checkout authorization. */
  mennyuSessionId?: string | null;
  /** Verified phone-first customer account from checkout OTP session. */
  customerAccountId?: string | null;
}

// ---- Deliverect (integration) ----
export interface DeliverectVendorMapping {
  channelLinkId: string;
  locationId?: string;
  accountId?: string;
}
