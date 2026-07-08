import "server-only";

/** Bump when required Square OAuth scopes change (v1 = catalog only, v2 = order injection). */
export const SQUARE_OAUTH_PERMISSIONS_VERSION = 2;

export const SQUARE_OAUTH_CATALOG_SCOPES = [
  "MERCHANT_PROFILE_READ",
  "ITEMS_READ",
] as const;

export const SQUARE_OAUTH_INJECTION_SCOPES = [
  "ORDERS_READ",
  "ORDERS_WRITE",
  "PAYMENTS_READ",
  "PAYMENTS_WRITE",
] as const;

/** Default scopes for production/sandbox OAuth (connect + catalog + order injection). */
export const SQUARE_OAUTH_SCOPES = [
  ...SQUARE_OAUTH_CATALOG_SCOPES,
  ...SQUARE_OAUTH_INJECTION_SCOPES,
] as const;

/** Debug-only minimal scopes (catalog connect). Never used for normal OAuth redirects. */
export const SQUARE_OAUTH_MINIMAL_DEBUG_SCOPES = [...SQUARE_OAUTH_CATALOG_SCOPES] as const;

export type SquareOAuthScope = (typeof SQUARE_OAUTH_SCOPES)[number];

export const SQUARE_OAUTH_SCOPE_RECONNECT_MESSAGE =
  "Reconnect Square to grant order routing permissions.";

export const SQUARE_OAUTH_PERMISSIONS_ADMIN_MESSAGE =
  "Square permissions are missing. Reconnect Square and approve ORDERS_WRITE/PAYMENTS_WRITE.";

export const SQUARE_ROUTING_PERMISSIONS_ERROR_CODE = "SQUARE_INSUFFICIENT_PERMISSIONS";

export type SquareOAuthScopeCoverage = {
  requiredScopes: string[];
  authorizedScopes: string[];
  missingRequiredScopes: string[];
  permissionsVersion: number;
  hasOrderInjectionScopes: boolean;
  needsReconnectForInjection: boolean;
};

export type SquareOAuthScopeMeta = {
  authorizedScopes?: string[] | null;
  requiredScopes?: string[] | null;
  missingRequiredScopes?: string[] | null;
  permissionsVersion?: number | null;
};

export function parseSquareAuthorizedScopes(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return [...new Set(raw.trim().split(/\s+/).filter(Boolean))];
}

export function evaluateSquareOAuthScopeCoverage(input: {
  authorizedScopes?: string[] | null;
  permissionsVersion?: number | null;
  requiredScopes?: readonly string[];
}): SquareOAuthScopeCoverage {
  const requiredScopes = [...(input.requiredScopes ?? SQUARE_OAUTH_SCOPES)];
  const authorizedScopes = [...new Set((input.authorizedScopes ?? []).filter(Boolean))];
  const permissionsVersion = input.permissionsVersion ?? 1;

  let missingRequiredScopes: string[];
  if (authorizedScopes.length === 0 && permissionsVersion < SQUARE_OAUTH_PERMISSIONS_VERSION) {
    missingRequiredScopes = [...SQUARE_OAUTH_INJECTION_SCOPES];
  } else if (authorizedScopes.length === 0) {
    missingRequiredScopes = [...requiredScopes];
  } else {
    missingRequiredScopes = requiredScopes.filter((scope) => !authorizedScopes.includes(scope));
  }

  const hasOrderInjectionScopes = SQUARE_OAUTH_INJECTION_SCOPES.every(
    (scope) => !missingRequiredScopes.includes(scope)
  );
  const needsReconnectForInjection = !hasOrderInjectionScopes;

  return {
    requiredScopes,
    authorizedScopes,
    missingRequiredScopes,
    permissionsVersion,
    hasOrderInjectionScopes,
    needsReconnectForInjection,
  };
}

export function evaluateSquareOAuthScopeCoverageFromMeta(
  meta: SquareOAuthScopeMeta | null | undefined
): SquareOAuthScopeCoverage {
  return evaluateSquareOAuthScopeCoverage({
    authorizedScopes: meta?.authorizedScopes ?? [],
    permissionsVersion: meta?.permissionsVersion ?? null,
    requiredScopes: meta?.requiredScopes ?? SQUARE_OAUTH_SCOPES,
  });
}

export function buildSquareOAuthScopeCapabilities(input: {
  authorizedScopes: string[];
  permissionsVersion?: number;
}): SquareOAuthScopeMeta & SquareOAuthScopeCoverage {
  const coverage = evaluateSquareOAuthScopeCoverage({
    authorizedScopes: input.authorizedScopes,
    permissionsVersion: input.permissionsVersion ?? SQUARE_OAUTH_PERMISSIONS_VERSION,
  });
  return {
    authorizedScopes: coverage.authorizedScopes,
    requiredScopes: coverage.requiredScopes,
    missingRequiredScopes: coverage.missingRequiredScopes,
    permissionsVersion: coverage.permissionsVersion,
    hasOrderInjectionScopes: coverage.hasOrderInjectionScopes,
    needsReconnectForInjection: coverage.needsReconnectForInjection,
  };
}

export function isSquareInsufficientPermissionsError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("sufficient permissions") ||
    lower.includes("required scopes") ||
    lower.includes("orders_write") ||
    lower.includes("payments_write") ||
    lower.includes("insufficient_oauth_scopes")
  );
}

export function resolveSquareOAuthScopesForAuthorize(input?: {
  debug?: boolean;
  minimalScope?: boolean;
}): readonly string[] {
  if (input?.debug && input?.minimalScope) {
    return SQUARE_OAUTH_MINIMAL_DEBUG_SCOPES;
  }
  return SQUARE_OAUTH_SCOPES;
}

export function formatSquareOAuthScopesForAuthorize(scopes: readonly string[]): string {
  return scopes.join(" ");
}
