import "server-only";

import {
  assertSquareOAuthConfigured,
  getSquareApiBaseUrl,
  resolveSquareEnvironment,
} from "@/lib/integrations/square/square-config";

const SQUARE_API_VERSION = "2025-04-16";

export type SquareOAuthTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_at?: string;
  merchant_id?: string;
  token_type?: string;
};

export type SquareLocation = {
  id: string;
  name: string;
  status?: string;
  address?: {
    address_line_1?: string;
    locality?: string;
    administrative_district_level_1?: string;
  };
};

export type SquareLocationsResponse = {
  locations?: SquareLocation[];
};

export class SquareApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown
  ) {
    super(message);
    this.name = "SquareApiError";
  }
}

export async function exchangeSquareOAuthCode(code: string): Promise<SquareOAuthTokenResponse> {
  const cfg = assertSquareOAuthConfigured();
  const base = getSquareApiBaseUrl(cfg.environment);
  const res = await fetch(`${base}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: cfg.applicationId,
      client_secret: cfg.applicationSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: cfg.redirectUrl,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as SquareOAuthTokenResponse & {
    message?: string;
    errors?: Array<{ detail?: string }>;
  };
  if (!res.ok) {
    const detail = body.errors?.[0]?.detail ?? body.message ?? res.statusText;
    throw new SquareApiError(`Square OAuth token exchange failed: ${detail}`, res.status, body);
  }
  if (!body.access_token?.trim()) {
    throw new SquareApiError("Square OAuth response missing access_token", res.status, body);
  }
  return body;
}

export async function refreshSquareOAuthToken(refreshToken: string): Promise<SquareOAuthTokenResponse> {
  const cfg = assertSquareOAuthConfigured();
  const base = getSquareApiBaseUrl(cfg.environment);
  const res = await fetch(`${base}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: cfg.applicationId,
      client_secret: cfg.applicationSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const body = (await res.json().catch(() => ({}))) as SquareOAuthTokenResponse & {
    message?: string;
    errors?: Array<{ detail?: string }>;
  };
  if (!res.ok) {
    const detail = body.errors?.[0]?.detail ?? body.message ?? res.statusText;
    throw new SquareApiError(`Square OAuth refresh failed: ${detail}`, res.status, body);
  }
  if (!body.access_token?.trim()) {
    throw new SquareApiError("Square refresh response missing access_token", res.status, body);
  }
  return body;
}

export async function fetchSquareLocations(accessToken: string): Promise<SquareLocation[]> {
  const base = getSquareApiBaseUrl(resolveSquareEnvironment());
  const res = await fetch(`${base}/v2/locations`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Square-Version": SQUARE_API_VERSION,
    },
  });
  const body = (await res.json().catch(() => ({}))) as SquareLocationsResponse & {
    errors?: Array<{ detail?: string }>;
  };
  if (!res.ok) {
    const detail = body.errors?.[0]?.detail ?? res.statusText;
    throw new SquareApiError(`Square locations fetch failed: ${detail}`, res.status, body);
  }
  return body.locations ?? [];
}

export async function fetchSquareMerchantProfile(accessToken: string): Promise<{ business_name?: string }> {
  const base = getSquareApiBaseUrl(resolveSquareEnvironment());
  const res = await fetch(`${base}/v2/merchants/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Square-Version": SQUARE_API_VERSION,
    },
  });
  const body = (await res.json().catch(() => ({}))) as {
    merchant?: { business_name?: string };
    errors?: Array<{ detail?: string }>;
  };
  if (!res.ok) {
    const detail = body.errors?.[0]?.detail ?? res.statusText;
    throw new SquareApiError(`Square merchant fetch failed: ${detail}`, res.status, body);
  }
  return body.merchant ?? {};
}
