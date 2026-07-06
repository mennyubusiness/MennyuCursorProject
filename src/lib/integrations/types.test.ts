import { describe, expect, it, vi } from "vitest";
import {
  INTEGRATION_CAPABILITIES,
  INTEGRATION_PROVIDERS,
  isIntegrationCapability,
  isIntegrationProvider,
} from "@/lib/integrations/types";

describe("integration types", () => {
  it("defines expected providers including future-ready POS names", () => {
    expect(INTEGRATION_PROVIDERS).toContain("manual_dashboard");
    expect(INTEGRATION_PROVIDERS).toContain("open_order");
    expect(INTEGRATION_PROVIDERS).toContain("deliverect");
    expect(INTEGRATION_PROVIDERS).toContain("square");
    expect(INTEGRATION_PROVIDERS).toContain("toast");
    expect(INTEGRATION_PROVIDERS).toContain("clover");
    expect(INTEGRATION_PROVIDERS).toContain("lightspeed");
  });

  it("defines integration capabilities", () => {
    expect(INTEGRATION_CAPABILITIES).toContain("order_injection");
    expect(INTEGRATION_CAPABILITIES).toContain("menu_import");
    expect(INTEGRATION_CAPABILITIES.length).toBeGreaterThanOrEqual(10);
  });

  it("type guards work", () => {
    expect(isIntegrationProvider("deliverect")).toBe(true);
    expect(isIntegrationProvider("unknown_pos")).toBe(false);
    expect(isIntegrationCapability("payments")).toBe(true);
    expect(isIntegrationCapability("teleport")).toBe(false);
  });
});
