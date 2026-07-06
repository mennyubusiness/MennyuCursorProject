/**
 * Normalized integration provider spine — provider-specific code lives at the edge;
 * core services consume these shared types.
 */

/** Active and future POS / routing providers. */
export const INTEGRATION_PROVIDERS = [
  "manual_dashboard",
  "open_order",
  "deliverect",
  "square",
  "toast",
  "clover",
  "lightspeed",
] as const;

export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

export const INTEGRATION_CAPABILITIES = [
  "menu_import",
  "menu_publish",
  "order_injection",
  "order_status_webhooks",
  "inventory_availability",
  "hours_sync",
  "price_sync",
  "external_order_lookup",
  "payments",
  "refunds",
] as const;

export type IntegrationCapability = (typeof INTEGRATION_CAPABILITIES)[number];

export const INTEGRATION_CONNECTION_STATUSES = [
  "not_configured",
  "pending",
  "connected",
  "error",
  "disconnected",
] as const;

export type IntegrationConnectionStatus = (typeof INTEGRATION_CONNECTION_STATUSES)[number];

export const PROVIDER_ENTITY_TYPES = [
  "menu_item",
  "modifier_group",
  "modifier_option",
  "category",
  "vendor_order",
] as const;

export type ProviderEntityType = (typeof PROVIDER_ENTITY_TYPES)[number];

export const PROVIDER_WEBHOOK_PROCESSING_STATUSES = [
  "received",
  "processed",
  "ignored",
  "failed",
] as const;

export type ProviderWebhookProcessingStatus =
  (typeof PROVIDER_WEBHOOK_PROCESSING_STATUSES)[number];

export const NORMALIZED_PROVIDER_ORDER_STATUSES = [
  "accepted",
  "preparing",
  "ready",
  "completed",
  "cancelled",
  "rejected",
  "failed",
  "unknown",
] as const;

export type NormalizedProviderOrderStatus = (typeof NORMALIZED_PROVIDER_ORDER_STATUSES)[number];

export type ProviderConnectionHealth = {
  provider: IntegrationProvider;
  status: IntegrationConnectionStatus;
  isReady: boolean;
  missingRequirements: string[];
  warnings: string[];
  lastCheckedAt: Date | null;
};

export type NormalizedMenuCategory = {
  externalCategoryId: string;
  name: string;
  sortOrder?: number;
};

export type NormalizedMenuItem = {
  externalItemId: string;
  name: string;
  description?: string | null;
  priceCents?: number | null;
  categoryExternalId?: string | null;
  isAvailable?: boolean;
};

export type NormalizedModifierOption = {
  externalOptionId: string;
  name: string;
  priceCents?: number | null;
};

export type NormalizedModifierGroup = {
  externalGroupId: string;
  name: string;
  minSelections?: number;
  maxSelections?: number | null;
  options: NormalizedModifierOption[];
};

export type NormalizedMenu = {
  externalMenuId: string | null;
  categories: NormalizedMenuCategory[];
  items: NormalizedMenuItem[];
  modifierGroups: NormalizedModifierGroup[];
  availability?: Record<string, unknown>;
  providerMetadata?: Record<string, unknown>;
};

export type NormalizedProviderOrderCustomer = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
};

export type NormalizedProviderOrderLineModifier = {
  externalModifierId: string;
  name: string;
  quantity: number;
  priceCents?: number;
};

export type NormalizedProviderOrderLineItem = {
  externalItemId?: string | null;
  internalMenuItemId?: string | null;
  name: string;
  quantity: number;
  unitPriceCents: number;
  modifiers: NormalizedProviderOrderLineModifier[];
};

export type NormalizedProviderOrderPaymentSummary = {
  subtotalCents: number;
  taxCents: number;
  tipCents: number;
  serviceFeeCents: number;
  totalCents: number;
};

export type NormalizedProviderOrder = {
  provider: IntegrationProvider;
  vendorId: string;
  vendorOrderId: string;
  orderId: string;
  pickupCode: string;
  fulfillmentType: "pickup";
  customer: NormalizedProviderOrderCustomer;
  items: NormalizedProviderOrderLineItem[];
  paymentSummary: NormalizedProviderOrderPaymentSummary;
  totals: NormalizedProviderOrderPaymentSummary;
  specialInstructions?: string | null;
  requestedPickupTime?: Date | null;
};

export type NormalizedProviderOrderResult = {
  success: boolean;
  externalOrderId?: string;
  externalOrderDisplayId?: string;
  providerStatus?: string;
  rawProviderResponseRef?: string;
  rawProviderResponseHash?: string;
  errorCode?: string;
  errorMessage?: string;
  skipped?: boolean;
};

export type NormalizedProviderStatusUpdate = {
  provider: IntegrationProvider;
  externalOrderId: string;
  vendorOrderId?: string | null;
  status: NormalizedProviderOrderStatus;
  occurredAt: Date;
  reason?: string | null;
  rawEventId?: string | null;
};

export type ProviderMappingHealth = {
  provider: IntegrationProvider;
  totalMappings: number;
  activeMappings: number;
  missingRequiredMappings: number;
  isHealthy: boolean;
  notes: string[];
};

export type ProviderCapabilityMatrix = Record<IntegrationCapability, boolean>;

export function isIntegrationProvider(value: string): value is IntegrationProvider {
  return (INTEGRATION_PROVIDERS as readonly string[]).includes(value);
}

export function isIntegrationCapability(value: string): value is IntegrationCapability {
  return (INTEGRATION_CAPABILITIES as readonly string[]).includes(value);
}
