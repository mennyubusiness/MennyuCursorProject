import "server-only";

import { env } from "@/lib/env";
import { isIntegrationTokenEncryptionConfigured } from "@/lib/integrations/integration-token-crypto";
import {
  formatSquareOAuthScopesForAuthorize,
  resolveSquareOAuthScopesForAuthorize,
  SQUARE_OAUTH_MINIMAL_DEBUG_SCOPES,
  SQUARE_OAUTH_SCOPES,
} from "@/lib/integrations/square/square-oauth-scopes";

export type SquareEnvironment = "sandbox" | "production";

export {
  SQUARE_OAUTH_SCOPES,
  SQUARE_OAUTH_MINIMAL_DEBUG_SCOPES,
  formatSquareOAuthScopesForAuthorize,
  resolveSquareOAuthScopesForAuthorize,
} from "@/lib/integrations/square/square-oauth-scopes";

/** OAuth authorize + token endpoints — must use connect.*, never bare squareup hosts. */
export const SQUARE_OAUTH_CONNECT_BASE_URLS = {
  production: "https://connect.squareup.com",
  sandbox: "https://connect.squareupsandbox.com",
} as const satisfies Record<SquareEnvironment, string>;

/** Square REST API v2 base URLs (same connect.* hosts as OAuth). */
export const SQUARE_API_BASE_URLS = {
  production: "https://connect.squareup.com",
  sandbox: "https://connect.squareupsandbox.com",
} as const satisfies Record<SquareEnvironment, string>;

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
  missingConfigLabels: string[];
  invalidConfigLabels: string[];
  disabledReasonLabels: string[];
  environmentMismatchWarnings: string[];
};

function parseSquareEnvironment(): SquareEnvironment | null {
  const raw = (env.SQUARE_ENVIRONMENT ?? env.SQUARE_MODE)?.trim().toLowerCase();
  if (raw === "sandbox" || raw === "production") return raw;
  return null;
}

function buildSquareConfigDiagnostics(input: {
  applicationId: string | null;
  applicationSecret: string | null;
  redirectUrl: string | null;
  environment: SquareEnvironment | null;
  configured: boolean;
  enableFlag: boolean;
  tokenStorageReady: boolean;
}): Pick<SquareConfigSnapshot, "missingConfigLabels" | "invalidConfigLabels" | "disabledReasonLabels"> {
  const missingConfigLabels: string[] = [];
  if (!input.applicationId) missingConfigLabels.push("Missing SQUARE_APPLICATION_ID");
  if (!input.applicationSecret) missingConfigLabels.push("Missing SQUARE_APPLICATION_SECRET");
  if (!input.redirectUrl) missingConfigLabels.push("Missing SQUARE_OAUTH_REDIRECT_URL");
  if (!input.environment) {
    missingConfigLabels.push("Missing SQUARE_ENVIRONMENT or SQUARE_MODE (must be sandbox or production)");
  }

  const invalidConfigLabels: string[] = [];
  const encryptionKey = env.INTEGRATION_TOKEN_ENCRYPTION_KEY?.trim();
  if (encryptionKey && encryptionKey.length < 32) {
    invalidConfigLabels.push("Invalid INTEGRATION_TOKEN_ENCRYPTION_KEY (min 32 characters)");
  }

  const disabledReasonLabels: string[] = [];
  if (!input.configured) {
    disabledReasonLabels.push("Square OAuth quartet incomplete (see missing config labels)");
  }
  if (env.NODE_ENV === "production" && !input.enableFlag) {
    disabledReasonLabels.push("ENABLE_SQUARE_INTEGRATION is not true in production");
  }
  if (!input.tokenStorageReady) {
    disabledReasonLabels.push(
      "Missing INTEGRATION_TOKEN_ENCRYPTION_KEY or AUTH_SECRET (min 32 characters) for token storage"
    );
  }

  return { missingConfigLabels, invalidConfigLabels, disabledReasonLabels };
}

/** Square sandbox application IDs are prefixed with `sandbox-`. */
export function inferSquareApplicationIdEnvironment(
  applicationId: string
): SquareEnvironment | null {
  const id = applicationId.trim().toLowerCase();
  if (id.startsWith("sandbox-")) return "sandbox";
  if (id.startsWith("sq0idp-") || id.startsWith("sq0idb-")) return "production";
  return null;
}

export function detectSquareEnvironmentMismatchWarnings(input: {
  applicationId: string | null;
  environment: SquareEnvironment | null;
  redirectUrl: string | null;
}): string[] {
  const warnings: string[] = [];
  if (input.applicationId && input.environment) {
    const inferred = inferSquareApplicationIdEnvironment(input.applicationId);
    if (inferred && inferred !== input.environment) {
      warnings.push(
        `SQUARE_APPLICATION_ID looks like ${inferred} credentials but SQUARE_ENVIRONMENT is ${input.environment}`
      );
    }
  }
  if (input.redirectUrl && input.environment) {
    try {
      const host = new URL(input.redirectUrl).hostname.toLowerCase();
      if (
        input.environment === "production" &&
        (host.includes("localhost") ||
          host.endsWith(".vercel.app") ||
          host.includes("127.0.0.1"))
      ) {
        warnings.push(
          "SQUARE_OAUTH_REDIRECT_URL hostname looks non-production while SQUARE_ENVIRONMENT is production"
        );
      }
      if (
        input.environment === "sandbox" &&
        (host === "www.openorderco.com" || host === "openorderco.com")
      ) {
        warnings.push(
          "SQUARE_OAUTH_REDIRECT_URL uses production domain while SQUARE_ENVIRONMENT is sandbox — confirm Square sandbox redirect URL matches exactly"
        );
      }
    } catch {
      warnings.push("SQUARE_OAUTH_REDIRECT_URL is not a valid URL");
    }
  }
  return warnings;
}

export function resolveSquareEnvironment(): SquareEnvironment {
  return parseSquareEnvironment() ?? "sandbox";
}

export function getSquareConnectBaseUrl(environment: SquareEnvironment = resolveSquareEnvironment()): string {
  return SQUARE_OAUTH_CONNECT_BASE_URLS[environment];
}

export function getSquareApiBaseUrl(environment: SquareEnvironment = resolveSquareEnvironment()): string {
  return SQUARE_API_BASE_URLS[environment];
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
  const tokenStorageReady = isIntegrationTokenEncryptionConfigured();
  const enabled =
    configured && (enableFlag || env.NODE_ENV !== "production") && tokenStorageReady;
  const diagnostics = buildSquareConfigDiagnostics({
    applicationId,
    applicationSecret,
    redirectUrl,
    environment,
    configured,
    enableFlag,
    tokenStorageReady,
  });
  const environmentMismatchWarnings = detectSquareEnvironmentMismatchWarnings({
    applicationId,
    environment,
    redirectUrl,
  });

  if (partiallyConfigured || (configured && !enabled) || environmentMismatchWarnings.length > 0) {
    console.warn(
      JSON.stringify({
        event: "square_config_diagnostics",
        configured,
        partiallyConfigured,
        enabled,
        tokenStorageReady,
        enableFlag,
        nodeEnv: env.NODE_ENV,
        environment,
        missingConfigLabels: diagnostics.missingConfigLabels,
        invalidConfigLabels: diagnostics.invalidConfigLabels,
        disabledReasonLabels: diagnostics.disabledReasonLabels,
        environmentMismatchWarnings,
      })
    );
  }

  return {
    configured,
    partiallyConfigured,
    environment,
    applicationId,
    redirectUrl,
    connectBaseUrl: configured ? getSquareConnectBaseUrl(environment!) : null,
    apiBaseUrl: configured ? getSquareApiBaseUrl(environment!) : null,
    tokenStorageReady,
    enabled,
    ...diagnostics,
    environmentMismatchWarnings,
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
  const authorizeUrl = new URL("/oauth2/authorize", getSquareConnectBaseUrl(cfg.environment));
  authorizeUrl.searchParams.set("client_id", cfg.applicationId);
  authorizeUrl.searchParams.set("scope", (input.scopes ?? SQUARE_OAUTH_SCOPES).join(" "));
  authorizeUrl.searchParams.set("state", input.state);
  authorizeUrl.searchParams.set("session", "false");
  authorizeUrl.searchParams.set("redirect_uri", cfg.redirectUrl);
  return authorizeUrl.toString();
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
  const environment =
    envName === "sandbox" || envName === "production" ? (envName as SquareEnvironment) : null;
  warnings.push(
    ...detectSquareEnvironmentMismatchWarnings({
      applicationId: envInput.SQUARE_APPLICATION_ID?.trim() || null,
      environment,
      redirectUrl: envInput.SQUARE_OAUTH_REDIRECT_URL?.trim() || null,
    })
  );
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
