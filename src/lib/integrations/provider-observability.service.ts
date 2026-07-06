import "server-only";

import type { IntegrationProvider } from "@/lib/integrations/types";
import { providerDisplayLabel } from "@/lib/integrations/provider-capabilities";
import { getProviderCapabilitiesForProvider } from "@/lib/integrations/provider-registry";
import {
  getProviderMappingHealth,
  getVendorIntegrationReadinessSummary,
} from "@/lib/integrations/provider-readiness.service";
import { prisma } from "@/lib/db";
import type { ProviderConnectionHealth } from "@/lib/integrations/types";

export type VendorIntegrationConnectionView = {
  id: string;
  provider: IntegrationProvider;
  providerLabel: string;
  status: string;
  displayName: string | null;
  externalAccountId: string | null;
  externalMerchantId: string | null;
  externalLocationId: string | null;
  externalStoreId: string | null;
  capabilities: string[];
  lastSyncAt: Date | null;
  lastWebhookAt: Date | null;
  lastHealthCheckAt: Date | null;
  errorCode: string | null;
  errorMessage: string | null;
  isActive: boolean;
};

export type VendorIntegrationObservability = {
  vendorId: string;
  connections: VendorIntegrationConnectionView[];
  readiness: Awaited<ReturnType<typeof getVendorIntegrationReadinessSummary>>;
  mappingHealth: Partial<Record<IntegrationProvider, Awaited<ReturnType<typeof getProviderMappingHealth>>>>;
  recentWebhookEvents: Array<{
    id: string;
    provider: IntegrationProvider;
    eventType: string;
    processingStatus: string;
    receivedAt: Date;
    externalEventId: string | null;
  }>;
  squareHealth: ProviderConnectionHealth | null;
};

function parseCapabilities(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string");
}

export async function getVendorIntegrationObservability(
  vendorId: string
): Promise<VendorIntegrationObservability | null> {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { id: true, deletedAt: true },
  });
  if (!vendor || vendor.deletedAt) return null;

  const [connections, readiness, recentWebhookEvents] = await Promise.all([
    prisma.vendorIntegrationConnection.findMany({
      where: { vendorId },
      orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
    }),
    getVendorIntegrationReadinessSummary(vendorId),
    prisma.providerWebhookEvent.findMany({
      where: { vendorId },
      orderBy: { receivedAt: "desc" },
      take: 10,
      select: {
        id: true,
        provider: true,
        eventType: true,
        processingStatus: true,
        receivedAt: true,
        externalEventId: true,
      },
    }),
  ]);

  const providersForMapping = new Set<IntegrationProvider>([
    ...(readiness.orderRouting ? [readiness.orderRouting.activeProvider] : []),
    ...(readiness.menuSource ? [readiness.menuSource.activeProvider] : []),
    ...connections.map((c) => c.provider as IntegrationProvider),
  ]);

  const mappingHealth: VendorIntegrationObservability["mappingHealth"] = {};
  await Promise.all(
    [...providersForMapping].map(async (provider) => {
      mappingHealth[provider] = await getProviderMappingHealth(vendorId, provider);
    })
  );

  let squareHealth: ProviderConnectionHealth | null = null;
  const { getSquareConfigSnapshot } = await import("@/lib/integrations/square/square-config");
  const squareSnap = getSquareConfigSnapshot();
  if (squareSnap.configured || squareSnap.partiallyConfigured || connections.some((c) => c.provider === "square")) {
    const { evaluateSquareConnectionHealth } = await import(
      "@/lib/integrations/square/square-connection.service"
    );
    squareHealth = await evaluateSquareConnectionHealth(vendorId);
  }

  return {
    vendorId,
    connections: connections.map((c) => ({
      id: c.id,
      provider: c.provider as IntegrationProvider,
      providerLabel: providerDisplayLabel(c.provider as IntegrationProvider),
      status: c.status,
      displayName: c.displayName,
      externalAccountId: c.externalAccountId,
      externalMerchantId: c.externalMerchantId,
      externalLocationId: c.externalLocationId,
      externalStoreId: c.externalStoreId,
      capabilities:
        parseCapabilities(c.capabilities).length > 0
          ? parseCapabilities(c.capabilities)
          : getProviderCapabilitiesForProvider(c.provider as IntegrationProvider),
      lastSyncAt: c.lastSyncAt,
      lastWebhookAt: c.lastWebhookAt,
      lastHealthCheckAt: c.lastHealthCheckAt,
      errorCode: c.errorCode,
      errorMessage: c.errorMessage,
      isActive: c.isActive,
    })),
    readiness,
    mappingHealth,
    recentWebhookEvents: recentWebhookEvents.map((e) => ({
      ...e,
      provider: e.provider as IntegrationProvider,
    })),
    squareHealth,
  };
}
