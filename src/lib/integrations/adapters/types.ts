import type {
  IntegrationCapability,
  IntegrationProvider,
  NormalizedMenu,
  NormalizedProviderOrder,
  NormalizedProviderOrderResult,
  NormalizedProviderStatusUpdate,
  ProviderConnectionHealth,
} from "@/lib/integrations/types";

export type ValidateConnectionInput = {
  vendorId?: string;
  connectionId?: string;
};

export type MapStatusWebhookContext = {
  payload: unknown;
  vendorId?: string | null;
  connectionId?: string | null;
};

export type OrderProviderAdapter = {
  provider: IntegrationProvider;
  capabilities: IntegrationCapability[];
  validateConnection(input: ValidateConnectionInput): Promise<ProviderConnectionHealth>;
  submitOrder(input: NormalizedProviderOrder): Promise<NormalizedProviderOrderResult>;
  mapStatusWebhook(context: MapStatusWebhookContext): Promise<NormalizedProviderStatusUpdate | null>;
};

export type MenuProviderAdapter = {
  provider: IntegrationProvider;
  capabilities: IntegrationCapability[];
  validateConnection(input: ValidateConnectionInput): Promise<ProviderConnectionHealth>;
  importMenu(connectionId: string): Promise<NormalizedMenu>;
  validateMappings(vendorId: string): Promise<ProviderConnectionHealth>;
};

export type ProviderAdapterUnavailableError = {
  code: "PROVIDER_NOT_REGISTERED" | "PROVIDER_NOT_CONFIGURED" | "ADAPTER_TYPE_UNSUPPORTED";
  provider: IntegrationProvider;
  message: string;
};

export function providerAdapterUnavailable(
  code: ProviderAdapterUnavailableError["code"],
  provider: IntegrationProvider,
  message: string
): ProviderAdapterUnavailableError {
  return { code, provider, message };
}
