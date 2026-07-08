/** User-facing Square OAuth / connection error codes (no secrets). */
export const SQUARE_OAUTH_ERROR_CODES = {
  missing_code_or_state: "missing_code_or_state",
  invalid_oauth_state: "invalid_oauth_state",
  oauth_state_expired: "oauth_state_expired",
  oauth_state_reused: "oauth_state_reused",
  access_denied: "access_denied",
  forbidden: "forbidden",
  oauth_failed: "oauth_failed",
  token_exchange_failed: "token_exchange_failed",
  merchant_fetch_failed: "merchant_fetch_failed",
  locations_fetch_failed: "locations_fetch_failed",
  no_active_locations: "no_active_locations",
  config_missing: "config_missing",
  token_encryption_failed: "token_encryption_failed",
} as const;

export type SquareOAuthErrorCode =
  (typeof SQUARE_OAUTH_ERROR_CODES)[keyof typeof SQUARE_OAUTH_ERROR_CODES];

const USER_MESSAGES: Record<string, string> = {
  missing_code_or_state:
    "Square did not return the authorization code. Please try connecting again.",
  invalid_oauth_state:
    "This Square connection request is invalid or was tampered with. Please start again.",
  oauth_state_expired:
    "This Square connection request expired. Please click Connect Square again.",
  oauth_state_reused:
    "This Square connection link was already used. Please click Connect Square again.",
  access_denied:
    "Square access was denied. Grant the requested permissions to connect.",
  forbidden: "You do not have permission to connect Square for this vendor.",
  oauth_failed: "Square authorization failed. Please try again.",
  token_exchange_failed:
    "Open Order could not exchange the Square authorization code. Verify Square app credentials and redirect URL.",
  merchant_fetch_failed:
    "Square connected but merchant profile could not be loaded. Try reconnecting.",
  locations_fetch_failed:
    "Square connected but locations could not be loaded. Try reconnecting.",
  no_active_locations:
    "Square authorized successfully but no active locations were found. Activate a location in Square, then reconnect.",
  config_missing: "Square OAuth is not configured on this deployment.",
  token_encryption_failed:
    "Token storage is not configured. Contact support before connecting Square in production.",
};

const INTERNAL_TO_CODE: Record<string, string> = {
  invalid_oauth_state: "invalid_oauth_state",
  bad_oauth_state_signature: "invalid_oauth_state",
  bad_oauth_state_version: "invalid_oauth_state",
  oauth_state_incomplete: "invalid_oauth_state",
  oauth_state_expired: "oauth_state_expired",
  oauth_state_reused: "oauth_state_reused",
};

export function normalizeSquareOAuthErrorCode(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return SQUARE_OAUTH_ERROR_CODES.oauth_failed;
  if (trimmed in SQUARE_OAUTH_ERROR_CODES) return trimmed;
  if (trimmed in INTERNAL_TO_CODE) return INTERNAL_TO_CODE[trimmed]!;
  if (trimmed === "access_denied") return SQUARE_OAUTH_ERROR_CODES.access_denied;
  return trimmed;
}

/**
 * Map Square API client errors to safe OAuth redirect codes.
 * Never pass raw Square API detail (status body text) into redirects.
 */
export function mapSquareApiErrorToOAuthCode(message: string): SquareOAuthErrorCode {
  const lower = message.toLowerCase();
  if (lower.includes("token exchange") || lower.includes("oauth2/token") || lower.includes("authorization_code")) {
    return SQUARE_OAUTH_ERROR_CODES.token_exchange_failed;
  }
  if (lower.includes("refresh")) {
    return SQUARE_OAUTH_ERROR_CODES.token_exchange_failed;
  }
  if (lower.includes("merchant")) {
    return SQUARE_OAUTH_ERROR_CODES.merchant_fetch_failed;
  }
  if (lower.includes("location")) {
    return SQUARE_OAUTH_ERROR_CODES.locations_fetch_failed;
  }
  return SQUARE_OAUTH_ERROR_CODES.oauth_failed;
}

export function resolveSquareOAuthUserMessage(code: string): string {
  const normalized = normalizeSquareOAuthErrorCode(code);
  return (
    USER_MESSAGES[normalized] ??
    "Square connection failed. Please try again or contact support."
  );
}

export function buildSquareIntegrationPageUrl(
  origin: string,
  vendorId: string,
  params?: Record<string, string>
): string {
  const url = new URL(`${origin}/vendor/${encodeURIComponent(vendorId)}/integrations/square`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

export function buildSquareOAuthErrorRedirect(
  origin: string,
  vendorId: string | null,
  errorCode: string
): string {
  const normalized = normalizeSquareOAuthErrorCode(errorCode);
  if (vendorId) {
    return buildSquareIntegrationPageUrl(origin, vendorId, {
      square_error: normalized,
    });
  }
  const url = new URL(`${origin}/vendor/select`);
  url.searchParams.set("square_error", normalized);
  return url.toString();
}
