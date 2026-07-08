import "server-only";

import {
  assertSquareOAuthConfigured,
  getSquareApiBaseUrl,
  resolveSquareEnvironment,
} from "@/lib/integrations/square/square-config";
import {
  SQUARE_CATALOG_LIST_TYPES,
  type SquareCatalogListResponse,
  type SquareCatalogObject,
} from "@/lib/integrations/square/square-catalog.types";
import type {
  SquareCreateExternalPaymentRequest,
  SquareCreateOrderRequest,
  SquareCreateOrderResponse,
  SquareCreatePaymentResponse,
} from "@/lib/integrations/square/square-order.types";

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

function squareCatalogHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    "Square-Version": SQUARE_API_VERSION,
  };
}

/** List all catalog objects for menu import (paginated). */
export async function fetchSquareCatalogObjects(
  accessToken: string,
  types: readonly string[] = SQUARE_CATALOG_LIST_TYPES
): Promise<SquareCatalogObject[]> {
  const base = getSquareApiBaseUrl(resolveSquareEnvironment());
  const objects: SquareCatalogObject[] = [];
  let cursor: string | undefined;

  do {
    const params = new URLSearchParams({ types: types.join(",") });
    if (cursor) params.set("cursor", cursor);
    const res = await fetch(`${base}/v2/catalog/list?${params.toString()}`, {
      headers: squareCatalogHeaders(accessToken),
    });
    const body = (await res.json().catch(() => ({}))) as SquareCatalogListResponse;
    if (!res.ok) {
      const detail = body.errors?.[0]?.detail ?? res.statusText;
      throw new SquareApiError(`Square catalog list failed: ${detail}`, res.status, body);
    }
    if (body.objects?.length) objects.push(...body.objects);
    cursor = body.cursor?.trim() || undefined;
  } while (cursor);

  return objects;
}

export async function fetchSquareCatalogForLocation(
  accessToken: string,
  locationId: string
): Promise<SquareCatalogObject[]> {
  const all = await fetchSquareCatalogObjects(accessToken);
  return all.filter((obj) => isSquareCatalogObjectAvailableAtLocation(obj, locationId));
}

export function isSquareCatalogObjectAvailableAtLocation(
  obj: SquareCatalogObject,
  locationId: string
): boolean {
  if (obj.is_deleted) return false;
  if (obj.present_at_all_locations) {
    return !(obj.absent_at_location_ids ?? []).includes(locationId);
  }
  const present = obj.present_at_location_ids ?? [];
  if (present.length > 0) return present.includes(locationId);
  return true;
}

function squareApiHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    "Square-Version": SQUARE_API_VERSION,
  };
}

export async function createSquareOrder(
  accessToken: string,
  body: SquareCreateOrderRequest
): Promise<SquareCreateOrderResponse> {
  const base = getSquareApiBaseUrl(resolveSquareEnvironment());
  const res = await fetch(`${base}/v2/orders`, {
    method: "POST",
    headers: squareApiHeaders(accessToken),
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as SquareCreateOrderResponse;
  if (!res.ok) {
    const detail = json.errors?.[0]?.detail ?? res.statusText;
    throw new SquareApiError(`Square create order failed: ${detail}`, res.status, json);
  }
  return json;
}

export async function createSquareExternalPayment(
  accessToken: string,
  body: SquareCreateExternalPaymentRequest
): Promise<SquareCreatePaymentResponse> {
  const base = getSquareApiBaseUrl(resolveSquareEnvironment());
  const res = await fetch(`${base}/v2/payments`, {
    method: "POST",
    headers: squareApiHeaders(accessToken),
    body: JSON.stringify({ ...body, autocomplete: body.autocomplete ?? true }),
  });
  const json = (await res.json().catch(() => ({}))) as SquareCreatePaymentResponse;
  if (!res.ok) {
    const detail = json.errors?.[0]?.detail ?? res.statusText;
    throw new SquareApiError(`Square external payment failed: ${detail}`, res.status, json);
  }
  return json;
}
