import "server-only";

import type { IntegrationConnectionStatus } from "@/lib/integrations/types";
import { getProviderCapabilities } from "@/lib/integrations/provider-capabilities";
import {
  deleteIntegrationProviderCredential,
  loadIntegrationProviderTokens,
  storeIntegrationProviderTokens,
  updateIntegrationProviderTokens,
} from "@/lib/integrations/integration-token-storage.service";
import {
  exchangeSquareOAuthCode,
  fetchSquareLocations,
  fetchSquareMerchantProfile,
  refreshSquareOAuthToken,
  type SquareLocation,
} from "@/lib/integrations/square/square-api.client";
import { resolveSquareEnvironment } from "@/lib/integrations/square/square-config";
import { prisma } from "@/lib/db";

export type SquareConnectionCapabilitiesMeta = {
  declaredCapabilities: string[];
  squareEnvironment: string;
  locations?: Array<Pick<SquareLocation, "id" | "name" | "status">>;
  pendingLocationSelection?: boolean;
  selectedLocationName?: string | null;
};

export type SquareConnectionView = {
  id: string;
  status: IntegrationConnectionStatus;
  displayName: string | null;
  externalMerchantId: string | null;
  externalLocationId: string | null;
  externalStoreId: string | null;
  accessTokenRef: string | null;
  lastHealthCheckAt: Date | null;
  errorCode: string | null;
  errorMessage: string | null;
  isActive: boolean;
  capabilitiesMeta: SquareConnectionCapabilitiesMeta | null;
  availableLocations: Array<{ id: string; name: string; status: string | null }>;
  needsLocationSelection: boolean;
};

function parseCapabilitiesMeta(raw: unknown): SquareConnectionCapabilitiesMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  return {
    declaredCapabilities: Array.isArray(obj.declaredCapabilities)
      ? obj.declaredCapabilities.filter((v): v is string => typeof v === "string")
      : [],
    squareEnvironment:
      typeof obj.squareEnvironment === "string" ? obj.squareEnvironment : resolveSquareEnvironment(),
    locations: Array.isArray(obj.locations)
      ? obj.locations
          .filter((l): l is Record<string, unknown> => Boolean(l && typeof l === "object"))
          .map((l) => ({
            id: String(l.id ?? ""),
            name: String(l.name ?? "Square location"),
            status: typeof l.status === "string" ? l.status : undefined,
          }))
          .filter((l) => l.id)
      : undefined,
    pendingLocationSelection: obj.pendingLocationSelection === true,
    selectedLocationName:
      typeof obj.selectedLocationName === "string" ? obj.selectedLocationName : null,
  };
}

function buildCapabilitiesJson(input: {
  locations?: SquareLocation[];
  pendingLocationSelection?: boolean;
  selectedLocationName?: string | null;
}): SquareConnectionCapabilitiesMeta {
  return {
    declaredCapabilities: getProviderCapabilities("square"),
    squareEnvironment: resolveSquareEnvironment(),
    locations: input.locations?.map((l) => ({
      id: l.id,
      name: l.name,
      status: l.status,
    })),
    pendingLocationSelection: input.pendingLocationSelection ?? false,
    selectedLocationName: input.selectedLocationName ?? null,
  };
}

export async function getActiveSquareConnectionForVendor(
  vendorId: string
): Promise<SquareConnectionView | null> {
  const row = await prisma.vendorIntegrationConnection.findFirst({
    where: { vendorId, provider: "square", isActive: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!row) return null;

  const meta = parseCapabilitiesMeta(row.capabilities);
  const availableLocations =
    meta?.locations?.map((l) => ({
      id: l.id,
      name: l.name,
      status: l.status ?? null,
    })) ?? [];

  return {
    id: row.id,
    status: row.status as IntegrationConnectionStatus,
    displayName: row.displayName,
    externalMerchantId: row.externalMerchantId,
    externalLocationId: row.externalLocationId,
    externalStoreId: row.externalStoreId,
    accessTokenRef: row.accessTokenRef,
    lastHealthCheckAt: row.lastHealthCheckAt,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    isActive: row.isActive,
    capabilitiesMeta: meta,
    availableLocations,
    needsLocationSelection: Boolean(meta?.pendingLocationSelection && !row.externalLocationId),
  };
}

async function upsertSquareConnection(input: {
  vendorId: string;
  status: IntegrationConnectionStatus;
  displayName?: string | null;
  externalMerchantId?: string | null;
  accessTokenRef?: string | null;
  refreshTokenRef?: string | null;
  externalLocationId?: string | null;
  externalStoreId?: string | null;
  capabilities: SquareConnectionCapabilitiesMeta;
  errorCode?: string | null;
  errorMessage?: string | null;
}) {
  const existing = await prisma.vendorIntegrationConnection.findFirst({
    where: { vendorId: input.vendorId, provider: "square", isActive: true },
    select: { id: true, accessTokenRef: true },
  });

  const data = {
    status: input.status,
    displayName: input.displayName ?? null,
    externalMerchantId: input.externalMerchantId ?? null,
    externalLocationId: input.externalLocationId ?? null,
    externalStoreId: input.externalStoreId ?? null,
    accessTokenRef: input.accessTokenRef ?? existing?.accessTokenRef ?? null,
    refreshTokenRef: input.refreshTokenRef ?? null,
    capabilities: input.capabilities as object,
    lastHealthCheckAt: new Date(),
    errorCode: input.errorCode ?? null,
    errorMessage: input.errorMessage ?? null,
    isActive: true,
  };

  if (existing) {
    return prisma.vendorIntegrationConnection.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.vendorIntegrationConnection.create({
    data: {
      vendorId: input.vendorId,
      provider: "square",
      ...data,
    },
  });
}

function activeSquareLocations(locations: SquareLocation[]): SquareLocation[] {
  return locations.filter((l) => (l.status ?? "ACTIVE").toUpperCase() === "ACTIVE");
}

export async function completeSquareOAuthForVendor(input: {
  vendorId: string;
  code: string;
}): Promise<{ connectionId: string; needsLocationSelection: boolean }> {
  const tokenResponse = await exchangeSquareOAuthCode(input.code);
  const expiresAt = tokenResponse.expires_at ? new Date(tokenResponse.expires_at) : null;

  const { credentialId } = await storeIntegrationProviderTokens({
    vendorId: input.vendorId,
    provider: "square",
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token ?? null,
    accessTokenExpiresAt: expiresAt,
  });

  const [locations, merchant] = await Promise.all([
    fetchSquareLocations(tokenResponse.access_token),
    fetchSquareMerchantProfile(tokenResponse.access_token).catch(() => ({})),
  ]);

  const activeLocations = activeSquareLocations(locations);
  const businessName =
    "business_name" in merchant && typeof merchant.business_name === "string"
      ? merchant.business_name
      : null;
  const displayName = businessName ? `Square — ${businessName}` : "Square connection";

  if (activeLocations.length === 0) {
    const connection = await upsertSquareConnection({
      vendorId: input.vendorId,
      status: "error",
      displayName,
      externalMerchantId: tokenResponse.merchant_id ?? null,
      accessTokenRef: credentialId,
      refreshTokenRef: credentialId,
      capabilities: buildCapabilitiesJson({ locations }),
      errorCode: "no_active_locations",
      errorMessage: "Square authorized but no active locations were returned.",
    });
    return { connectionId: connection.id, needsLocationSelection: false };
  }

  if (activeLocations.length === 1) {
    const loc = activeLocations[0]!;
    const connection = await upsertSquareConnection({
      vendorId: input.vendorId,
      status: "connected",
      displayName,
      externalMerchantId: tokenResponse.merchant_id ?? null,
      accessTokenRef: credentialId,
      refreshTokenRef: credentialId,
      externalLocationId: loc.id,
      externalStoreId: loc.id,
      capabilities: buildCapabilitiesJson({
        locations: activeLocations,
        pendingLocationSelection: false,
        selectedLocationName: loc.name,
      }),
    });
    return { connectionId: connection.id, needsLocationSelection: false };
  }

  const connection = await upsertSquareConnection({
    vendorId: input.vendorId,
    status: "pending",
    displayName,
    externalMerchantId: tokenResponse.merchant_id ?? null,
    accessTokenRef: credentialId,
    refreshTokenRef: credentialId,
    capabilities: buildCapabilitiesJson({
      locations: activeLocations,
      pendingLocationSelection: true,
    }),
    errorCode: null,
    errorMessage: null,
  });

  return { connectionId: connection.id, needsLocationSelection: true };
}

export async function selectSquareLocationForVendor(input: {
  vendorId: string;
  locationId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const connection = await getActiveSquareConnectionForVendor(input.vendorId);
  if (!connection) return { ok: false, error: "No active Square connection." };

  const location = connection.availableLocations.find((l) => l.id === input.locationId);
  if (!location) return { ok: false, error: "Location not found for this Square connection." };

  const meta = connection.capabilitiesMeta ?? buildCapabilitiesJson({});
  await prisma.vendorIntegrationConnection.update({
    where: { id: connection.id },
    data: {
      status: "connected",
      externalLocationId: location.id,
      externalStoreId: location.id,
      errorCode: null,
      errorMessage: null,
      lastHealthCheckAt: new Date(),
      capabilities: {
        ...meta,
        pendingLocationSelection: false,
        selectedLocationName: location.name,
      } as object,
    },
  });

  return { ok: true };
}

export async function disconnectSquareForVendor(vendorId: string): Promise<void> {
  const connection = await prisma.vendorIntegrationConnection.findFirst({
    where: { vendorId, provider: "square", isActive: true },
    select: { id: true, accessTokenRef: true },
  });
  if (!connection) return;

  if (connection.accessTokenRef) {
    await deleteIntegrationProviderCredential(connection.accessTokenRef);
  }

  await prisma.vendorIntegrationConnection.update({
    where: { id: connection.id },
    data: {
      isActive: false,
      status: "disconnected",
      accessTokenRef: null,
      refreshTokenRef: null,
      errorCode: null,
      errorMessage: null,
      lastHealthCheckAt: new Date(),
    },
  });
}

export async function ensureSquareAccessToken(connection: SquareConnectionView): Promise<string | null> {
  if (!connection.accessTokenRef) return null;
  const tokens = await loadIntegrationProviderTokens(connection.accessTokenRef);
  if (!tokens) return null;

  const expiresAt = tokens.accessTokenExpiresAt?.getTime() ?? 0;
  const needsRefresh = expiresAt > 0 && expiresAt < Date.now() + 60_000;
  if (!needsRefresh) return tokens.accessToken;

  if (!tokens.refreshToken) return tokens.accessToken;

  const refreshed = await refreshSquareOAuthToken(tokens.refreshToken);
  const newExpires = refreshed.expires_at ? new Date(refreshed.expires_at) : null;
  await updateIntegrationProviderTokens(connection.accessTokenRef, {
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token ?? tokens.refreshToken,
    accessTokenExpiresAt: newExpires,
  });
  return refreshed.access_token;
}

export async function evaluateSquareConnectionHealth(vendorId: string) {
  const snap = await import("@/lib/integrations/square/square-config").then((m) =>
    m.getSquareConfigSnapshot()
  );
  const missing: string[] = [];
  const warnings: string[] = [];

  if (!snap.configured) {
    missing.push("Square OAuth is not configured on this deployment");
    return {
      provider: "square" as const,
      status: "not_configured" as IntegrationConnectionStatus,
      isReady: false,
      missingRequirements: missing,
      warnings,
      lastCheckedAt: new Date(),
    };
  }

  if (!snap.tokenStorageReady) {
    missing.push("Integration token encryption is not configured");
  }

  const connection = await getActiveSquareConnectionForVendor(vendorId);
  if (!connection) {
    missing.push("Square is not connected for this vendor");
    return {
      provider: "square" as const,
      status: "not_configured" as IntegrationConnectionStatus,
      isReady: false,
      missingRequirements: missing,
      warnings,
      lastCheckedAt: new Date(),
    };
  }

  if (!connection.accessTokenRef) {
    missing.push("Square OAuth token reference missing");
  }

  if (connection.needsLocationSelection || !connection.externalLocationId) {
    missing.push("Square location not selected");
  }

  if (connection.status === "error") {
    missing.push(connection.errorMessage ?? "Square connection error");
  }

  if (connection.accessTokenRef && connection.externalLocationId) {
    try {
      const token = await ensureSquareAccessToken(connection);
      if (token) {
        const locations = await fetchSquareLocations(token);
        const selected = locations.find((l) => l.id === connection.externalLocationId);
        if (!selected) {
          missing.push("Selected Square location no longer available");
        } else if ((selected.status ?? "ACTIVE").toUpperCase() !== "ACTIVE") {
          warnings.push(`Selected Square location status is ${selected.status ?? "unknown"}`);
        }
      }
    } catch (e) {
      missing.push(e instanceof Error ? e.message : "Square token validation failed");
    }
  }

  const isReady = missing.length === 0;
  let status: IntegrationConnectionStatus = connection.status as IntegrationConnectionStatus;
  if (!isReady && status === "connected") status = "pending";

  await prisma.vendorIntegrationConnection.update({
    where: { id: connection.id },
    data: { lastHealthCheckAt: new Date() },
  });

  return {
    provider: "square" as const,
    status,
    isReady,
    missingRequirements: missing,
    warnings,
    lastCheckedAt: new Date(),
  };
}
