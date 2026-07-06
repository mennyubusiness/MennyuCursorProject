import type {
  IntegrationCapability,
  IntegrationProvider,
  ProviderCapabilityMatrix,
} from "@/lib/integrations/types";

const CAP = {
  menu_import: false,
  menu_publish: false,
  order_injection: false,
  order_status_webhooks: false,
  inventory_availability: false,
  hours_sync: false,
  price_sync: false,
  external_order_lookup: false,
  payments: false,
  refunds: false,
} satisfies ProviderCapabilityMatrix;

function matrix(partial: Partial<ProviderCapabilityMatrix>): ProviderCapabilityMatrix {
  return { ...CAP, ...partial };
}

/** Declared capabilities per provider — not every provider supports every capability. */
export const PROVIDER_CAPABILITY_MATRIX: Record<IntegrationProvider, ProviderCapabilityMatrix> = {
  manual_dashboard: matrix({
    order_injection: false,
    order_status_webhooks: false,
  }),
  open_order: matrix({
    menu_import: false,
    menu_publish: true,
  }),
  deliverect: matrix({
    menu_import: true,
    menu_publish: true,
    order_injection: true,
    order_status_webhooks: true,
    inventory_availability: true,
    hours_sync: true,
    external_order_lookup: true,
  }),
  square: matrix({
    menu_import: true,
    order_injection: true,
    order_status_webhooks: true,
    inventory_availability: true,
    hours_sync: true,
    payments: true,
    refunds: true,
  }),
  toast: matrix({
    menu_import: true,
    order_injection: true,
    order_status_webhooks: true,
  }),
  clover: matrix({
    menu_import: true,
    order_injection: true,
    order_status_webhooks: true,
  }),
  lightspeed: matrix({
    menu_import: true,
    order_injection: true,
    order_status_webhooks: true,
  }),
};

export function getProviderCapabilities(provider: IntegrationProvider): IntegrationCapability[] {
  const row = PROVIDER_CAPABILITY_MATRIX[provider];
  return (Object.keys(row) as IntegrationCapability[]).filter((key) => row[key]);
}

export function providerSupportsCapability(
  provider: IntegrationProvider,
  capability: IntegrationCapability
): boolean {
  return PROVIDER_CAPABILITY_MATRIX[provider][capability] === true;
}

export function assertProviderSupportsCapability(
  provider: IntegrationProvider,
  capability: IntegrationCapability
): void {
  if (!providerSupportsCapability(provider, capability)) {
    throw new Error(`Provider ${provider} does not support capability ${capability}`);
  }
}

export function providerDisplayLabel(provider: IntegrationProvider): string {
  switch (provider) {
    case "manual_dashboard":
      return "Manual dashboard";
    case "open_order":
      return "Open Order menu builder";
    case "deliverect":
      return "Deliverect";
    case "square":
      return "Square";
    case "toast":
      return "Toast";
    case "clover":
      return "Clover";
    case "lightspeed":
      return "Lightspeed";
    default:
      return provider;
  }
}
