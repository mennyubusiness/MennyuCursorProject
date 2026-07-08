import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/integrations/square/square-config", () => ({
  getSquareConfigSnapshot: vi.fn(() => ({
    configured: false,
    partiallyConfigured: false,
    tokenStorageReady: false,
    enabled: false,
    environment: null,
    missingConfigLabels: ["Missing SQUARE_APPLICATION_ID"],
    invalidConfigLabels: [],
    disabledReasonLabels: [],
    environmentMismatchWarnings: [],
  })),
}));

import {
  assertProviderSupportsCapabilityOrThrow,
  getMenuProviderAdapter,
  getOrderProviderAdapter,
  providerSupportsCapability,
  safeGetOrderProviderAdapter,
} from "@/lib/integrations/provider-registry";

describe("provider registry", () => {
  it("returns manual_dashboard order adapter", () => {
    const adapter = getOrderProviderAdapter("manual_dashboard");
    expect(adapter?.provider).toBe("manual_dashboard");
    expect(adapter?.capabilities).toBeDefined();
  });

  it("returns open_order menu adapter", () => {
    const adapter = getMenuProviderAdapter("open_order");
    expect(adapter?.provider).toBe("open_order");
  });

  it("returns deliverect adapters", () => {
    expect(getOrderProviderAdapter("deliverect")?.provider).toBe("deliverect");
    expect(getMenuProviderAdapter("deliverect")?.provider).toBe("deliverect");
  });

  it("returns null for unsupported order provider", () => {
    expect(getOrderProviderAdapter("open_order")).toBeNull();
    expect(getMenuProviderAdapter("manual_dashboard")).toBeNull();
  });

  it("safeGetOrderProviderAdapter fails safely for unknown provider", () => {
    expect(safeGetOrderProviderAdapter("not_a_provider")).toBeNull();
  });

  it("capability checks work", () => {
    expect(providerSupportsCapability("deliverect", "order_injection")).toBe(true);
    expect(providerSupportsCapability("manual_dashboard", "order_injection")).toBe(false);
    expect(() =>
      assertProviderSupportsCapabilityOrThrow("manual_dashboard", "order_injection")
    ).toThrow(/does not support capability/);
  });

  it("square placeholder is registered but not configured", async () => {
    const adapter = getOrderProviderAdapter("square");
    expect(adapter?.provider).toBe("square");
    const health = await adapter!.validateConnection({ vendorId: "v1" });
    expect(health.isReady).toBe(false);
    expect(health.status).toBe("not_configured");
  });
});
