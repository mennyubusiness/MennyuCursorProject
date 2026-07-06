import { describe, expect, it } from "vitest";
import {
  getSquareConfigSnapshot,
  validateSquareProductionConfig,
} from "@/lib/integrations/square/square-config";

describe("square config", () => {
  it("reports not configured when env vars missing", () => {
    const snap = getSquareConfigSnapshot();
    expect(snap.configured).toBe(false);
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
});
