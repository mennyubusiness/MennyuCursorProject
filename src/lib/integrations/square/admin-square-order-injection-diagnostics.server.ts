import "server-only";

import type { VendorOrderRoutingMode } from "@prisma/client";
import { env } from "@/lib/env";
import { getSquareConfigSnapshot } from "@/lib/integrations/square/square-config";
import {
  evaluateSquareConnectionHealth,
  getActiveSquareConnectionForVendor,
} from "@/lib/integrations/square/square-connection.service";
import { loadSquareOrderRoutingReadiness } from "@/lib/integrations/square/square-order-routing-readiness";
import {
  evaluateSquareOAuthScopeCoverageFromMeta,
  SQUARE_OAUTH_SCOPES,
} from "@/lib/integrations/square/square-oauth-scopes";
import { prisma } from "@/lib/db";

export type AdminSquareConnectionDiagnosticStatus = "connected" | "error" | "missing";

export type AdminSquareOrderInjectionDiagnostics = {
  global: {
    enableSquareIntegration: boolean;
    squareRoutingLive: boolean;
    squareEnvironment: "sandbox" | "production" | null;
    squareOAuthConfigured: boolean;
  };
  vendor: {
    orderRoutingMode: VendorOrderRoutingMode;
    squareOrderRoutingEnabled: boolean;
    squareConnectionStatus: AdminSquareConnectionDiagnosticStatus;
    selectedSquareLocation: "present" | "missing";
    publishedSquareImportedMenu: "present" | "missing";
    activeItemMappings: number;
    activeModifierMappings: number;
    routingReadiness: "ready" | "not_ready";
    blockingReasons: string[];
    prerequisitesReady: boolean;
    injectionOperationalReady: boolean;
    requiredOAuthScopes: string[];
    authorizedOAuthScopes: string[];
    missingOAuthScopes: string[];
    oauthPermissionsVersion: number | null;
  };
};

function deriveSquareConnectionStatus(input: {
  hasConnection: boolean;
  connectionHealthy: boolean;
  connectionStatus: string | null;
}): AdminSquareConnectionDiagnosticStatus {
  if (!input.hasConnection) return "missing";
  if (input.connectionHealthy && input.connectionStatus === "connected") return "connected";
  return "error";
}

export function loadAdminSquareEnvDiagnostics(): AdminSquareOrderInjectionDiagnostics["global"] {
  const squareConfig = getSquareConfigSnapshot();
  return {
    enableSquareIntegration: env.ENABLE_SQUARE_INTEGRATION === "true",
    squareRoutingLive: env.SQUARE_ROUTING_LIVE === "true",
    squareEnvironment: squareConfig.environment,
    squareOAuthConfigured: squareConfig.configured,
  };
}

export async function loadAdminSquareOrderInjectionDiagnostics(
  vendorId: string
): Promise<AdminSquareOrderInjectionDiagnostics | null> {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: {
      orderRoutingMode: true,
      squareOrderRoutingEnabled: true,
    },
  });
  if (!vendor) return null;

  const [readiness, connection, health] = await Promise.all([
    loadSquareOrderRoutingReadiness(vendorId),
    getActiveSquareConnectionForVendor(vendorId),
    evaluateSquareConnectionHealth(vendorId),
  ]);

  const squareConnectionStatus = deriveSquareConnectionStatus({
    hasConnection: Boolean(connection),
    connectionHealthy: health.isReady,
    connectionStatus: connection?.status ?? null,
  });

  const scopeCoverage = evaluateSquareOAuthScopeCoverageFromMeta(connection?.capabilitiesMeta);

  return {
    global: loadAdminSquareEnvDiagnostics(),
    vendor: {
      orderRoutingMode: vendor.orderRoutingMode,
      squareOrderRoutingEnabled: vendor.squareOrderRoutingEnabled,
      squareConnectionStatus,
      selectedSquareLocation: readiness.locationId?.trim() ? "present" : "missing",
      publishedSquareImportedMenu: readiness.hasSquarePublishedMenu ? "present" : "missing",
      activeItemMappings: readiness.activeItemMappingCount,
      activeModifierMappings: readiness.activeModifierMappingCount,
      routingReadiness: readiness.injectionOperationalReady ? "ready" : "not_ready",
      blockingReasons: readiness.injectionBlockingReasons,
      prerequisitesReady: readiness.prerequisitesReady,
      injectionOperationalReady: readiness.injectionOperationalReady,
      requiredOAuthScopes: scopeCoverage.requiredScopes.length
        ? scopeCoverage.requiredScopes
        : [...SQUARE_OAUTH_SCOPES],
      authorizedOAuthScopes: scopeCoverage.authorizedScopes,
      missingOAuthScopes: scopeCoverage.missingRequiredScopes,
      oauthPermissionsVersion: scopeCoverage.permissionsVersion,
    },
  };
}
