/**
 * Deliverect Commerce API: fetch published store menus.
 *
 * **Assumption (Deliverect docs):** `GET /commerce/{accountId}/stores/{storeId}/menus`
 * where `storeId` is the **channel link id** (same value as `Vendor.deliverectChannelLinkId`).
 * `accountId` is the Deliverect **account** id (`Vendor.deliverectAccountId`).
 *
 * @see https://developers.deliverect.com/reference/commerce-channel-api-stores-get-store-menus
 */
import "server-only";
import { env } from "@/lib/env";
import { getDeliverectAuthHeaders } from "@/integrations/deliverect/auth";

const DEFAULT_BASE = "https://api.deliverect.com";
const LOG_PREFIX = "[Deliverect menu API]";

export type DeliverectMenuFulfillmentType = "delivery" | "pickup" | "curbside" | "eatIn";

export type FetchDeliverectStoreMenusParams = {
  accountId: string;
  storeId: string;
  fulfillmentType?: DeliverectMenuFulfillmentType;
};

export type FetchDeliverectStoreMenusResult = {
  ok: boolean;
  httpStatus: number;
  body: unknown;
  error?: string;
};

/**
 * OAuth Bearer (cached) or `DELIVERECT_API_KEY` — same pattern as {@link postDeliverectOrderStatusUpdate}.
 */
async function deliverectAuthHeadersForGet(): Promise<Record<string, string> | null> {
  const apiKey = env.DELIVERECT_API_KEY?.trim();
  if (apiKey) {
    return { Authorization: `Bearer ${apiKey}` };
  }
  const oauth = await getDeliverectAuthHeaders();
  if (!oauth.Authorization) {
    return null;
  }
  return oauth;
}

/**
 * If Commerce menus response wraps the menu document, return the inner object for Phase 1A.
 * Keeps verbatim API body separate in `MenuImportRawPayload`.
 */
export function pickNormalizerInputFromCommerceMenusResponse(body: unknown): unknown {
  if (body == null) return body;
  if (Array.isArray(body)) {
    if (body.length === 1 && body[0] != null && typeof body[0] === "object" && !Array.isArray(body[0])) {
      return body[0];
    }
    return body;
  }
  if (typeof body === "object" && !Array.isArray(body)) {
    const o = body as Record<string, unknown>;
    const menus = o.menus;
    if (Array.isArray(menus) && menus.length === 1 && menus[0] != null && typeof menus[0] === "object") {
      return menus[0] as Record<string, unknown>;
    }
  }
  return body;
}

export async function fetchDeliverectCommerceStoreMenus(
  params: FetchDeliverectStoreMenusParams
): Promise<FetchDeliverectStoreMenusResult> {
  const base = (env.DELIVERECT_API_URL ?? DEFAULT_BASE).replace(/\/$/, "");
  const q = params.fulfillmentType
    ? `?fulfillmentType=${encodeURIComponent(params.fulfillmentType)}`
    : "";
  const url = `${base}/commerce/${encodeURIComponent(params.accountId)}/stores/${encodeURIComponent(params.storeId)}/menus${q}`;

  const authHeaders = await deliverectAuthHeadersForGet();
  if (!authHeaders) {
    return {
      ok: false,
      httpStatus: 503,
      body: null,
      error:
        "Deliverect API not configured: set DELIVERECT_API_KEY or DELIVERECT_CLIENT_ID + DELIVERECT_CLIENT_SECRET",
    };
  }

  try {
    console.info(`${LOG_PREFIX} GET ${url}`);
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...authHeaders,
      },
    });

    const body = (await res.json().catch(() => null)) as unknown;

    if (!res.ok) {
      const msg =
        body && typeof body === "object" && body !== null && "message" in body
          ? String((body as { message?: unknown }).message)
          : res.statusText;
      console.warn(`${LOG_PREFIX} Non-OK status=${res.status} message=${msg}`);
      return {
        ok: false,
        httpStatus: res.status,
        body,
        error: `Deliverect menu API HTTP ${res.status}: ${msg}`,
      };
    }

    return { ok: true, httpStatus: res.status, body };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn(`${LOG_PREFIX} fetch error: ${message}`);
    return { ok: false, httpStatus: 0, body: null, error: message };
  }
}
