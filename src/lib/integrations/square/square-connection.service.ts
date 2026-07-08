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
  SquareApiError,
  type SquareLocation,
} from "@/lib/integrations/square/square-api.client";
import {
  resolveSquareEnvironment,
  type SquareEnvironment,
} from "@/lib/integrations/square/square-config";
import { IntegrationTokenEncryptionNotConfiguredError } from "@/lib/integrations/integration-token-crypto";
import { prisma } from "@/lib/db";

export type SquareConnectionCapabilitiesMeta = {
  declaredCapabilities: string[];
  squareEnvironment: string;
  locations?: Array<
    Pick<SquareLocation, "id" | "name" | "status"> & {
      addressLine?: string | null;
    }
  >;
  pendingLocationSelection?: boolean;
  selectedLocationName?: string | null;
  selectedLocationAddress?: string | null;
  connectedAt?: string | null;
  lastTokenRefreshAt?: string | null;
};

export type SquareConnectionView = {
  id: string;
  status: IntegrationConnectionStatus;
  displayName: string | null;
  externalMerchantId: string | null;
  externalLocationId: string | null;
  externalStoreId: string | null;
  accessTokenRef: string | null;
  connectedAt: Date | null;
  lastHealthCheckAt: Date | null;
  lastTokenRefreshAt: Date | null;
  errorCode: string | null;
  errorMessage: string | null;
  isActive: boolean;
  squareEnvironment: SquareEnvironment | null;
  capabilitiesMeta: SquareConnectionCapabilitiesMeta | null;
  availableLocations: Array<{
    id: string;
    name: string;
    status: string | null;
    addressLine: string | null;
  }>;
  needsLocationSelection: boolean;
  selectedLocationAddress: string | null;
};

function formatSquareLocationAddress(location: SquareLocation): string | null {
  const parts = [
    location.address?.address_line_1,
    location.address?.locality,
    location.address?.administrative_district_level_1,
  ].filter((part): part is string => Boolean(part?.trim()));
  return parts.length > 0 ? parts.join(", ") : null;
}

function mapLocationForMeta(location: SquareLocation) {
  return {
    id: location.id,
    name: location.name,
    status: location.status,
    addressLine: formatSquareLocationAddress(location),
  };
}

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
            addressLine:
              typeof l.addressLine === "string"
                ? l.addressLine
                : typeof l.address === "string"
                  ? l.address
                  : null,
          }))
          .filter((l) => l.id)
      : undefined,
    pendingLocationSelection: obj.pendingLocationSelection === true,
    selectedLocationName:
      typeof obj.selectedLocationName === "string" ? obj.selectedLocationName : null,
    selectedLocationAddress:
      typeof obj.selectedLocationAddress === "string" ? obj.selectedLocationAddress : null,
    connectedAt: typeof obj.connectedAt === "string" ? obj.connectedAt : null,
    lastTokenRefreshAt:
      typeof obj.lastTokenRefreshAt === "string" ? obj.lastTokenRefreshAt : null,
  };
}

function buildCapabilitiesJson(input: {
  locations?: SquareLocation[];
  pendingLocationSelection?: boolean;
  selectedLocationName?: string | null;
  selectedLocationAddress?: string | null;
  connectedAt?: string | null;
  lastTokenRefreshAt?: string | null;
}): SquareConnectionCapabilitiesMeta {
  return {
    declaredCapabilities: getProviderCapabilities("square"),
    squareEnvironment: resolveSquareEnvironment(),
    locations: input.locations?.map(mapLocationForMeta),
    pendingLocationSelection: input.pendingLocationSelection ?? false,
    selectedLocationName: input.selectedLocationName ?? null,
    selectedLocationAddress: input.selectedLocationAddress ?? null,
    connectedAt: input.connectedAt ?? new Date().toISOString(),
    lastTokenRefreshAt: input.lastTokenRefreshAt ?? null,
  };
}

function parseStoredEnvironment(meta: SquareConnectionCapabilitiesMeta | null): SquareEnvironment | null {
  const envName = meta?.squareEnvironment?.toLowerCase();
  if (envName === "sandbox" || envName === "production") return envName;
  return null;
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
      addressLine: l.addressLine ?? null,
    })) ?? [];

  return {
    id: row.id,
    status: row.status as IntegrationConnectionStatus,
    displayName: row.displayName,
    externalMerchantId: row.externalMerchantId,
    externalLocationId: row.externalLocationId,
    externalStoreId: row.externalStoreId,
    accessTokenRef: row.accessTokenRef,
    connectedAt: meta?.connectedAt ? new Date(meta.connectedAt) : row.createdAt,
    lastHealthCheckAt: row.lastHealthCheckAt,
    lastTokenRefreshAt: meta?.lastTokenRefreshAt ? new Date(meta.lastTokenRefreshAt) : null,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    isActive: row.isActive,
    squareEnvironment: parseStoredEnvironment(meta),
    capabilitiesMeta: meta,
    availableLocations,
    needsLocationSelection: Boolean(meta?.pendingLocationSelection && !row.externalLocationId),
    selectedLocationAddress: meta?.selectedLocationAddress ?? null,
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
    select: { id: true, accessTokenRef: true, capabilities: true },
  });

  const priorMeta = parseCapabilitiesMeta(existing?.capabilities);
  const capabilities = {
    ...input.capabilities,
    connectedAt: priorMeta?.connectedAt ?? input.capabilities.connectedAt ?? new Date().toISOString(),
    lastTokenRefreshAt:
      input.capabilities.lastTokenRefreshAt ?? priorMeta?.lastTokenRefreshAt ?? null,
  };

  const data = {
    status: input.status,
    displayName: input.displayName ?? null,
    externalMerchantId: input.externalMerchantId ?? null,
    externalLocationId: input.externalLocationId ?? null,
    externalStoreId: input.externalStoreId ?? null,
    accessTokenRef: input.accessTokenRef ?? existing?.accessTokenRef ?? null,
    refreshTokenRef: input.refreshTokenRef ?? null,
    capabilities: capabilities as object,
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

async function replaceSquareCredentialAfterReconnect(input: {
  vendorId: string;
  previousCredentialId: string | null;
  newCredentialId: string;
}): Promise<void> {
  if (
    input.previousCredentialId &&
    input.previousCredentialId !== input.newCredentialId
  ) {
    await deleteIntegrationProviderCredential(input.previousCredentialId);
  }
}

function activeSquareLocations(locations: SquareLocation[]): SquareLocation[] {
  return locations.filter((l) => (l.status ?? "ACTIVE").toUpperCase() === "ACTIVE");
}

async function markSquareTokenRefreshFailed(connectionId: string, error: unknown): Promise<void> {
  const message =
    error instanceof SquareApiError
      ? `Square token refresh failed: ${error.message}`
      : error instanceof Error
        ? error.message
        : "Square token refresh failed";
  const row = await prisma.vendorIntegrationConnection.findUnique({
    where: { id: connectionId },
    select: { capabilities: true },
  });
  const meta = parseCapabilitiesMeta(row?.capabilities) ?? buildCapabilitiesJson({});
  await prisma.vendorIntegrationConnection.update({
    where: { id: connectionId },
    data: {
      status: "error",
      errorCode: "token_refresh_failed",
      errorMessage: message,
      lastHealthCheckAt: new Date(),
      capabilities: meta as object,
    },
  });
}

async function updateConnectionCapabilities(
  connectionId: string,
  patch: Partial<SquareConnectionCapabilitiesMeta>
): Promise<void> {
  const row = await prisma.vendorIntegrationConnection.findUnique({
    where: { id: connectionId },
    select: { capabilities: true },
  });
  const meta = parseCapabilitiesMeta(row?.capabilities) ?? buildCapabilitiesJson({});
  await prisma.vendorIntegrationConnection.update({
    where: { id: connectionId },
    data: {
      capabilities: { ...meta, ...patch } as object,
    },
  });
}

export async function completeSquareOAuthForVendor(input: {
  vendorId: string;
  code: string;
}): Promise<{ connectionId: string; needsLocationSelection: boolean }> {
  const existing = await prisma.vendorIntegrationConnection.findFirst({
    where: { vendorId: input.vendorId, provider: "square", isActive: true },
    select: { accessTokenRef: true },
  });
  const previousCredentialId = existing?.accessTokenRef ?? null;

  let tokenResponse;
  try {
    tokenResponse = await exchangeSquareOAuthCode(input.code);
  } catch (e) {
    if (e instanceof SquareApiError) {
      throw new Error("token_exchange_failed");
    }
    throw e;
  }

  const expiresAt = tokenResponse.expires_at ? new Date(tokenResponse.expires_at) : null;

  let credentialId: string;
  try {
    ({ credentialId } = await storeIntegrationProviderTokens({
      vendorId: input.vendorId,
      provider: "square",
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token ?? null,
      accessTokenExpiresAt: expiresAt,
    }));
  } catch (e) {
    if (e instanceof IntegrationTokenEncryptionNotConfiguredError) {
      throw new Error("token_encryption_failed");
    }
    throw e;
  }

  let locations: SquareLocation[];
  try {
    locations = await fetchSquareLocations(tokenResponse.access_token);
  } catch (e) {
    await deleteIntegrationProviderCredential(credentialId);
    if (e instanceof SquareApiError) {
      throw new Error("locations_fetch_failed");
    }
    throw e;
  }
  const merchant = await fetchSquareMerchantProfile(tokenResponse.access_token).catch(
    () => ({}) as { business_name?: string }
  );

  const activeLocations = activeSquareLocations(locations);
  const businessName =
    typeof merchant.business_name === "string" ? merchant.business_name : null;
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
      errorMessage:
        "Square authorized successfully but no active locations were found. Activate a location in Square, then reconnect.",
    });
    await replaceSquareCredentialAfterReconnect({
      vendorId: input.vendorId,
      previousCredentialId,
      newCredentialId: credentialId,
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
        selectedLocationAddress: formatSquareLocationAddress(loc),
      }),
    });
    await replaceSquareCredentialAfterReconnect({
      vendorId: input.vendorId,
      previousCredentialId,
      newCredentialId: credentialId,
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
  await replaceSquareCredentialAfterReconnect({
    vendorId: input.vendorId,
    previousCredentialId,
    newCredentialId: credentialId,
  });

  return { connectionId: connection.id, needsLocationSelection: true };
}

export async function selectSquareLocationForVendor(input: {
  vendorId: string;
  locationId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const connection = await getActiveSquareConnectionForVendor(input.vendorId);
  if (!connection) return { ok: false, error: "No active Square connection." };

  const cached = connection.availableLocations.find((l) => l.id === input.locationId);
  if (!cached) {
    return { ok: false, error: "Location not found for this Square connection." };
  }
  if ((cached.status ?? "ACTIVE").toUpperCase() !== "ACTIVE") {
    return {
      ok: false,
      error: "Selected location is not active. Choose an active Square location.",
    };
  }

  if (connection.accessTokenRef) {
    const token = await ensureSquareAccessToken(connection);
    if (token) {
      const liveLocations = await fetchSquareLocations(token);
      const live = liveLocations.find((l) => l.id === input.locationId);
      if (!live) {
        return {
          ok: false,
          error: "Location is no longer available on this Square account.",
        };
      }
      if (activeSquareLocations([live]).length === 0) {
        return {
          ok: false,
          error: "Selected location is not active in Square.",
        };
      }
    }
  }

  const meta = connection.capabilitiesMeta ?? buildCapabilitiesJson({});
  await prisma.vendorIntegrationConnection.update({
    where: { id: connection.id },
    data: {
      status: "connected",
      externalLocationId: cached.id,
      externalStoreId: cached.id,
      errorCode: null,
      errorMessage: null,
      lastHealthCheckAt: new Date(),
      capabilities: {
        ...meta,
        pendingLocationSelection: false,
        selectedLocationName: cached.name,
        selectedLocationAddress: cached.addressLine,
      } as object,
    },
  });

  return { ok: true };
}

export async function disconnectSquareForVendor(vendorId: string): Promise<void> {
  const connection = await prisma.vendorIntegrationConnection.findFirst({
    where: { vendorId, provider: "square", isActive: true },
    select: { id: true, accessTokenRef: true, refreshTokenRef: true },
  });
  if (!connection) return;

  const credentialIds = new Set(
    [connection.accessTokenRef, connection.refreshTokenRef].filter(
      (id): id is string => Boolean(id?.trim())
    )
  );
  for (const credentialId of credentialIds) {
    await deleteIntegrationProviderCredential(credentialId);
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

export async function ensureSquareAccessToken(
  connection: SquareConnectionView
): Promise<string | null> {
  if (!connection.accessTokenRef) return null;
  const tokens = await loadIntegrationProviderTokens(connection.accessTokenRef);
  if (!tokens) return null;

  const expiresAt = tokens.accessTokenExpiresAt?.getTime() ?? 0;
  const needsRefresh = expiresAt > 0 && expiresAt < Date.now() + 60_000;
  if (!needsRefresh) return tokens.accessToken;

  if (!tokens.refreshToken) return tokens.accessToken;

  try {
    const refreshed = await refreshSquareOAuthToken(tokens.refreshToken);
    const newExpires = refreshed.expires_at ? new Date(refreshed.expires_at) : null;
    await updateIntegrationProviderTokens(connection.accessTokenRef, {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? tokens.refreshToken,
      accessTokenExpiresAt: newExpires,
    });
    await updateConnectionCapabilities(connection.id, {
      lastTokenRefreshAt: new Date().toISOString(),
    });
    return refreshed.access_token;
  } catch (e) {
    await markSquareTokenRefreshFailed(connection.id, e);
    throw e;
  }
}

export async function evaluateSquareConnectionHealth(vendorId: string) {
  const snap = await import("@/lib/integrations/square/square-config").then((m) =>
    m.getSquareConfigSnapshot()
  );
  const missing: string[] = [];
  const warnings: string[] = [...snap.environmentMismatchWarnings];

  if (!snap.configured) {
    missing.push(
      ...snap.missingConfigLabels,
      ...snap.invalidConfigLabels,
      ...(snap.missingConfigLabels.length === 0
        ? ["Square OAuth is not configured on this deployment"]
        : [])
    );
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

  if (
    connection.squareEnvironment &&
    snap.environment &&
    connection.squareEnvironment !== snap.environment
  ) {
    warnings.push(
      `Connected Square credentials are from ${connection.squareEnvironment} but deployment SQUARE_ENVIRONMENT is ${snap.environment}`
    );
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

  let nextStatus: IntegrationConnectionStatus = connection.status;
  let nextErrorCode = connection.errorCode;
  let nextErrorMessage = connection.errorMessage;

  if (connection.accessTokenRef && connection.externalLocationId) {
    try {
      const token = await ensureSquareAccessToken(connection);
      if (token) {
        const locations = await fetchSquareLocations(token);
        const selected = locations.find((l) => l.id === connection.externalLocationId);
        if (!selected) {
          missing.push("Selected Square location no longer available — choose another location");
          nextStatus = "pending";
          nextErrorCode = "location_unavailable";
          nextErrorMessage = "Selected Square location is no longer available.";
        } else if ((selected.status ?? "ACTIVE").toUpperCase() !== "ACTIVE") {
          missing.push("Selected Square location is inactive — choose another location");
          warnings.push(`Selected Square location status is ${selected.status ?? "unknown"}`);
          nextStatus = "error";
          nextErrorCode = "location_inactive";
          nextErrorMessage = `Selected Square location is ${selected.status ?? "inactive"}.`;
        }
      }
    } catch (e) {
      missing.push(e instanceof Error ? e.message : "Square token validation failed");
      if (connection.status === "connected") {
        nextStatus = "error";
      }
    }
  }

  const isReady = missing.length === 0;
  if (!isReady && nextStatus === "connected") {
    nextStatus = "pending";
  }

  await prisma.vendorIntegrationConnection.update({
    where: { id: connection.id },
    data: {
      lastHealthCheckAt: new Date(),
      status: nextStatus,
      errorCode: isReady ? null : nextErrorCode,
      errorMessage: isReady ? null : nextErrorMessage,
    },
  });

  return {
    provider: "square" as const,
    status: nextStatus,
    isReady,
    missingRequirements: missing,
    warnings,
    lastCheckedAt: new Date(),
  };
}

export type SquareConnectionObservability = {
  merchantId: string | null;
  businessDisplayName: string | null;
  locationId: string | null;
  locationName: string | null;
  locationAddress: string | null;
  squareEnvironment: string | null;
  deploymentEnvironment: string | null;
  connectedAt: string | null;
  lastHealthCheckAt: string | null;
  lastTokenRefreshAt: string | null;
  status: IntegrationConnectionStatus;
  errorCode: string | null;
  errorMessage: string | null;
};

export async function getSquareConnectionObservability(
  vendorId: string
): Promise<SquareConnectionObservability | null> {
  const connection = await getActiveSquareConnectionForVendor(vendorId);
  if (!connection) return null;
  const snap = await import("@/lib/integrations/square/square-config").then((m) =>
    m.getSquareConfigSnapshot()
  );
  return {
    merchantId: connection.externalMerchantId,
    businessDisplayName: connection.displayName,
    locationId: connection.externalLocationId,
    locationName: connection.capabilitiesMeta?.selectedLocationName ?? null,
    locationAddress: connection.selectedLocationAddress,
    squareEnvironment: connection.squareEnvironment,
    deploymentEnvironment: snap.environment,
    connectedAt: connection.connectedAt?.toISOString() ?? null,
    lastHealthCheckAt: connection.lastHealthCheckAt?.toISOString() ?? null,
    lastTokenRefreshAt: connection.lastTokenRefreshAt?.toISOString() ?? null,
    status: connection.status,
    errorCode: connection.errorCode,
    errorMessage: connection.errorMessage,
  };
}
