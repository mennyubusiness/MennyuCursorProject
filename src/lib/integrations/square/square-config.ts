import "server-only";

import { env } from "@/lib/env";
import { isIntegrationTokenEncryptionConfigured } from "@/lib/integrations/integration-token-crypto";

export type SquareEnvironment = "sandbox" | "production";

export const SQUARE_OAUTH_SCOPES = [
  "MERCHANT_PROFILE_READ",
  "ITEMS_READ",
] as const;

export type SquareConfigSnapshot = {
  configured: boolean;
  partiallyConfigured: boolean;
  environment: SquareEnvironment | null;
  applicationId: string | null;
  redirectUrl: string | null;
  connectBaseUrl: string | null;
  apiBaseUrl: string | null;
  tokenStorageReady: boolean;
  enabled: boolean;
};

function parseSquareEnvironment(): SquareEnvironment | null {
  const raw = (env.SQUARE_ENVIRONMENT ?? env.SQUARE_MODE)?.trim().toLowerCase();
  if (raw === "sandbox" || raw === "production") return raw;
  return null;
}

export function resolveSquareEnvironment(): SquareEnvironment {
  return parseSquareEnvironment() ?? "sandbox";
}

export function getSquareConnectBaseUrl(environment: SquareEnvironment = resolveSquareEnvironment()): string {
  return environment === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";
}

export function getSquareApiBaseUrl(environment: SquareEnvironment = resolveSquareEnvironment()): string {
  return getSquareConnectBaseUrl(environment);
}

export function getSquareConfigSnapshot(): SquareConfigSnapshot {
  const applicationId = env.SQUARE_APPLICATION_ID?.trim() || null;
  const applicationSecret = env.SQUARE_APPLICATION_SECRET?.trim() || null;
  const redirectUrl = env.SQUARE_OAUTH_REDIRECT_URL?.trim() || null;
  const environment = parseSquareEnvironment();
  const squareVars = [applicationId, applicationSecret, redirectUrl, environment?.toString()].filter(Boolean);
  const partiallyConfigured = squareVars.length > 0 && squareVars.length < 4;
  const configured = Boolean(applicationId && applicationSecret && redirectUrl && environment);
  const enableFlag = env.ENABLE_SQUARE_INTEGRATION?.trim().toLowerCase() === "true";
  const enabled = configured && (enableFlag || env.NODE_ENV !== "production");

  return {
    configured,
    partiallyConfigured,
    environment,
    applicationId,
    redirectUrl,
    connectBaseUrl: configured ? getSquareConnectBaseUrl(environment!) : null,
    apiBaseUrl: configured ? getSquareApiBaseUrl(environment!) : null,
    tokenStorageReady: isIntegrationTokenEncryptionConfigured(),
    enabled: enabled && configured && isIntegrationTokenEncryptionConfigured(),
  };
}

export function assertSquareOAuthConfigured(): {
  applicationId: string;
  applicationSecret: string;
  redirectUrl: string;
  environment: SquareEnvironment;
} {
  const snap = getSquareConfigSnapshot();
  if (!snap.configured) {
    throw new Error("Square OAuth is not fully configured for this environment.");
  }
  if (!snap.tokenStorageReady) {
    throw new Error(
      "Integration token encryption is not configured. Set INTEGRATION_TOKEN_ENCRYPTION_KEY before connecting Square in production."
    );
  }
  if (!snap.enabled && env.NODE_ENV === "production") {
    throw new Error(
      "Square integration is disabled in production. Set ENABLE_SQUARE_INTEGRATION=true when ready."
    );
  }
  return {
    applicationId: snap.applicationId!,
    applicationSecret: env.SQUARE_APPLICATION_SECRET!.trim(),
    redirectUrl: snap.redirectUrl!,
    environment: snap.environment!,
  };
}

export function buildSquareAuthorizationUrl(input: {
  state: string;
  scopes?: readonly string[];
}): string {
  const cfg = assertSquareOAuthConfigured();
  const base = getSquareConnectBaseUrl(cfg.environment);
  const params = new URLSearchParams({
    client_id: cfg.applicationId,
    scope: (input.scopes ?? SQUARE_OAUTH_SCOPES).join(" "),
    state: input.state,
    session: "false",
    redirect_uri: cfg.redirectUrl,
  });
  return `${base}/oauth2/authorize?${params.toString()}`;
}

export function validateSquareProductionConfig(envInput: {
  SQUARE_APPLICATION_ID?: string;
  SQUARE_APPLICATION_SECRET?: string;
  SQUARE_OAUTH_REDIRECT_URL?: string;
  SQUARE_ENVIRONMENT?: string;
  SQUARE_MODE?: string;
  ENABLE_SQUARE_INTEGRATION?: string;
  INTEGRATION_TOKEN_ENCRYPTION_KEY?: string;
  AUTH_SECRET?: string;
  NODE_ENV?: string;
}): { warnings: string[] } {
  const warnings: string[] = [];
  const ids = [
    envInput.SQUARE_APPLICATION_ID,
    envInput.SQUARE_APPLICATION_SECRET,
    envInput.SQUARE_OAUTH_REDIRECT_URL,
    envInput.SQUARE_ENVIRONMENT ?? envInput.SQUARE_MODE,
  ];
  const setCount = ids.filter((v) => Boolean(v?.trim())).length;
  if (setCount > 0 && setCount < 4) {
    warnings.push(
      "Square env is partially configured — set SQUARE_APPLICATION_ID, SQUARE_APPLICATION_SECRET, SQUARE_OAUTH_REDIRECT_URL, and SQUARE_ENVIRONMENT (or SQUARE_MODE) together."
    );
  }
  const envName = (envInput.SQUARE_ENVIRONMENT ?? envInput.SQUARE_MODE)?.trim().toLowerCase();
  if (envName === "sandbox") {
    warnings.push("Square is configured for sandbox — use production credentials only on live hosts.");
  } else if (envName === "production" && envInput.NODE_ENV === "production") {
    warnings.push("Square environment is production on a production host — verify OAuth redirect URL matches Square dashboard.");
  }
  if (
    setCount === 4 &&
    envInput.NODE_ENV === "production" &&
    envInput.ENABLE_SQUARE_INTEGRATION?.trim().toLowerCase() !== "true"
  ) {
    warnings.push(
      "Square OAuth credentials are set but ENABLE_SQUARE_INTEGRATION is not true — Square connect UI stays hidden in production."
    );
  }
  return { warnings };
}
