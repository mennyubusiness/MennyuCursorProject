import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const envState = vi.hoisted(() => ({
  NODE_ENV: "test" as string,
  SQUARE_APPLICATION_ID: undefined as string | undefined,
  SQUARE_APPLICATION_SECRET: undefined as string | undefined,
  SQUARE_OAUTH_REDIRECT_URL: undefined as string | undefined,
  SQUARE_ENVIRONMENT: undefined as "sandbox" | "production" | undefined,
  SQUARE_MODE: undefined as "sandbox" | "production" | undefined,
  ENABLE_SQUARE_INTEGRATION: undefined as string | undefined,
  INTEGRATION_TOKEN_ENCRYPTION_KEY: undefined as string | undefined,
  AUTH_SECRET: undefined as string | undefined,
}));

vi.mock("@/lib/env", () => ({
  env: envState,
}));

import {
  buildSquareAuthorizationUrl,
  getSquareApiBaseUrl,
  getSquareConfigSnapshot,
  getSquareConnectBaseUrl,
  SQUARE_API_BASE_URLS,
  SQUARE_OAUTH_CONNECT_BASE_URLS,
  validateSquareProductionConfig,
} from "@/lib/integrations/square/square-config";

const REDIRECT_URL = "https://www.openorderco.com/api/integrations/square/oauth/callback";

function configureSquareOAuth(environment: "sandbox" | "production") {
  envState.NODE_ENV = "test";
  envState.SQUARE_APPLICATION_ID = "sq0idp-test-app";
  envState.SQUARE_APPLICATION_SECRET = "sq0csp-test-secret";
  envState.SQUARE_OAUTH_REDIRECT_URL = REDIRECT_URL;
  envState.SQUARE_ENVIRONMENT = environment;
  envState.SQUARE_MODE = undefined;
  envState.ENABLE_SQUARE_INTEGRATION = "true";
  envState.INTEGRATION_TOKEN_ENCRYPTION_KEY = "integration-token-encryption-key-32";
}

describe("square config", () => {
  beforeEach(() => {
    envState.NODE_ENV = "test";
    envState.SQUARE_APPLICATION_ID = undefined;
    envState.SQUARE_APPLICATION_SECRET = undefined;
    envState.SQUARE_OAUTH_REDIRECT_URL = undefined;
    envState.SQUARE_ENVIRONMENT = undefined;
    envState.SQUARE_MODE = undefined;
    envState.ENABLE_SQUARE_INTEGRATION = undefined;
    envState.INTEGRATION_TOKEN_ENCRYPTION_KEY = undefined;
    envState.AUTH_SECRET = undefined;
  });

  it("reports not configured when env vars missing", () => {
    const snap = getSquareConfigSnapshot();
    expect(snap.configured).toBe(false);
    expect(snap.missingConfigLabels.length).toBeGreaterThan(0);
  });

  it("builds missing labels from diagnostics helper shape", () => {
    const snap = getSquareConfigSnapshot();
    expect(Array.isArray(snap.missingConfigLabels)).toBe(true);
    expect(Array.isArray(snap.disabledReasonLabels)).toBe(true);
    if (!snap.configured) {
      expect(snap.missingConfigLabels.length).toBeGreaterThan(0);
      expect(snap.enabled).toBe(false);
    }
  });

  it("warns on partial Square configuration", () => {
    const { warnings } = validateSquareProductionConfig({
      SQUARE_APPLICATION_ID: "sq0idp-xxx",
      NODE_ENV: "production",
    });
    expect(warnings.some((w) => w.includes("partially configured"))).toBe(true);
  });

  it("distinguishes sandbox environment in warnings", () => {
    const { warnings } = validateSquareProductionConfig({
      SQUARE_APPLICATION_ID: "id",
      SQUARE_APPLICATION_SECRET: "secret",
      SQUARE_OAUTH_REDIRECT_URL: "https://example.com/callback",
      SQUARE_ENVIRONMENT: "sandbox",
      NODE_ENV: "production",
    });
    expect(warnings.some((w) => w.toLowerCase().includes("sandbox"))).toBe(true);
  });

  it("uses connect.squareupsandbox.com for sandbox OAuth connect base", () => {
    expect(getSquareConnectBaseUrl("sandbox")).toBe("https://connect.squareupsandbox.com");
    expect(SQUARE_OAUTH_CONNECT_BASE_URLS.sandbox).toBe("https://connect.squareupsandbox.com");
  });

  it("uses connect.squareup.com for production OAuth connect base", () => {
    expect(getSquareConnectBaseUrl("production")).toBe("https://connect.squareup.com");
    expect(SQUARE_OAUTH_CONNECT_BASE_URLS.production).toBe("https://connect.squareup.com");
  });

  it("keeps API base URLs on connect.* hosts per environment", () => {
    expect(getSquareApiBaseUrl("sandbox")).toBe(SQUARE_API_BASE_URLS.sandbox);
    expect(getSquareApiBaseUrl("production")).toBe(SQUARE_API_BASE_URLS.production);
    expect(getSquareApiBaseUrl("sandbox")).toBe("https://connect.squareupsandbox.com");
    expect(getSquareApiBaseUrl("production")).toBe("https://connect.squareup.com");
  });

  it("builds sandbox OAuth authorize URL on connect.squareupsandbox.com", () => {
    configureSquareOAuth("sandbox");
    const url = buildSquareAuthorizationUrl({ state: "signed_state_token" });
    expect(url.startsWith("https://connect.squareupsandbox.com/oauth2/authorize")).toBe(true);
    expect(url.includes("https://squareupsandbox.com/oauth2/authorize")).toBe(false);

    const parsed = new URL(url);
    expect(parsed.hostname).toBe("connect.squareupsandbox.com");
    expect(parsed.pathname).toBe("/oauth2/authorize");
    expect(parsed.searchParams.get("client_id")).toBe("sq0idp-test-app");
    expect(parsed.searchParams.get("scope")).toBe("MERCHANT_PROFILE_READ ITEMS_READ");
    expect(parsed.searchParams.get("state")).toBe("signed_state_token");
    expect(parsed.searchParams.get("session")).toBe("false");
    expect(parsed.searchParams.get("redirect_uri")).toBe(REDIRECT_URL);
  });

  it("builds production OAuth authorize URL on connect.squareup.com", () => {
    configureSquareOAuth("production");
    const url = buildSquareAuthorizationUrl({ state: "signed_state_token" });
    expect(url.startsWith("https://connect.squareup.com/oauth2/authorize")).toBe(true);

    const parsed = new URL(url);
    expect(parsed.hostname).toBe("connect.squareup.com");
    expect(parsed.pathname).toBe("/oauth2/authorize");
    expect(parsed.searchParams.get("client_id")).toBe("sq0idp-test-app");
    expect(parsed.searchParams.get("scope")).toBe("MERCHANT_PROFILE_READ ITEMS_READ");
    expect(parsed.searchParams.get("state")).toBe("signed_state_token");
    expect(parsed.searchParams.get("session")).toBe("false");
    expect(parsed.searchParams.get("redirect_uri")).toBe(REDIRECT_URL);
  });
});
