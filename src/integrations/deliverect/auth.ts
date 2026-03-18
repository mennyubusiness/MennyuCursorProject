/**
 * Deliverect OAuth: client credentials flow, in-memory token cache.
 * Used by the Deliverect HTTP client for Bearer auth on outbound API requests.
 */
import "server-only";
import { env } from "@/lib/env";

const LOG_PREFIX = "[Deliverect OAuth]";

/** Default token endpoint (staging). Override with DELIVERECT_TOKEN_URL. */
const DEFAULT_TOKEN_URL = "https://api.staging.deliverect.com/oauth/token";
/** Default audience for production. Use staging audience when using staging token URL. */
const DEFAULT_AUDIENCE_PRODUCTION = "https://api.deliverect.com";
const DEFAULT_AUDIENCE_STAGING = "https://api.staging.deliverect.com";

/** Reuse token until this many seconds before expiry. */
const EXPIRE_BUFFER_SECONDS = 60;

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

let cached: CachedToken | null = null;

/**
 * Request a new access token from Deliverect OAuth token endpoint.
 * Uses client_credentials grant with client_id, client_secret, audience.
 */
async function fetchNewToken(): Promise<CachedToken> {
  const tokenUrl = env.DELIVERECT_TOKEN_URL ?? DEFAULT_TOKEN_URL;
  const audience =
    env.DELIVERECT_AUDIENCE ??
    (tokenUrl.includes("staging") ? DEFAULT_AUDIENCE_STAGING : DEFAULT_AUDIENCE_PRODUCTION);
  const clientId = env.DELIVERECT_CLIENT_ID;
  const clientSecret = env.DELIVERECT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("DELIVERECT_CLIENT_ID and DELIVERECT_CLIENT_SECRET are required for OAuth");
  }

  // Deliverect token endpoint expects application/json (401 when using form-urlencoded).
  const body = JSON.stringify({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    audience,
  });

  console.info(
    `${LOG_PREFIX} Token request tokenUrl=${tokenUrl} hasClientId=${!!clientId} hasClientSecret=${!!clientSecret} grant_type=client_credentials audience=${audience}`
  );

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!res.ok) {
    const msg = data.error_description ?? data.error ?? res.statusText;
    console.warn(
      `${LOG_PREFIX} Token request failed status=${res.status} error=${msg} responseKeys=${Object.keys(data).filter((k) => !k.toLowerCase().includes("token")).join(",")}`
    );
    throw new Error(`Deliverect OAuth token failed: ${msg}`);
  }

  const accessToken = data.access_token;
  if (!accessToken || typeof accessToken !== "string") {
    console.warn(`${LOG_PREFIX} Token response missing access_token`);
    throw new Error("Deliverect OAuth response missing access_token");
  }

  const expiresIn = typeof data.expires_in === "number" ? data.expires_in : 3600;
  const expiresAt = Date.now() + (expiresIn - EXPIRE_BUFFER_SECONDS) * 1000;

  console.info(
    `${LOG_PREFIX} Token obtained expiresIn=${expiresIn}s (reuse until ${new Date(expiresAt).toISOString()})`
  );

  return { accessToken, expiresAt };
}

/**
 * Return a valid Bearer access token, using cache if not expired.
 * Fetches a new token when cache is empty or expired.
 */
export async function getDeliverectAccessToken(): Promise<string | null> {
  if (!env.DELIVERECT_CLIENT_ID || !env.DELIVERECT_CLIENT_SECRET) {
    return null;
  }

  if (cached && cached.expiresAt > Date.now()) {
    return cached.accessToken;
  }

  try {
    cached = await fetchNewToken();
    return cached.accessToken;
  } catch (e) {
    cached = null;
    const message = e instanceof Error ? e.message : String(e);
    console.warn(`${LOG_PREFIX} Token fetch error: ${message}`);
    return null;
  }
}

/**
 * Return headers object for authenticating Deliverect API requests.
 * Returns { Authorization: "Bearer <token>" } when credentials are configured and token is obtained; otherwise {}.
 */
export async function getDeliverectAuthHeaders(): Promise<Record<string, string>> {
  const token = await getDeliverectAccessToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
