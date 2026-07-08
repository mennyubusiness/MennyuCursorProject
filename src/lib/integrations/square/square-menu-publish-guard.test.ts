import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/integrations/square/square-connection.service", () => ({
  evaluateSquareConnectionHealth: vi.fn(),
}));

import { evaluateSquareConnectionHealth } from "@/lib/integrations/square/square-connection.service";
import { assertSquareMenuPublishAllowed } from "@/lib/integrations/square/square-menu-publish-guard.server";

describe("assertSquareMenuPublishAllowed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows publish when Square connection is healthy", async () => {
    vi.mocked(evaluateSquareConnectionHealth).mockResolvedValue({
      provider: "square",
      status: "connected",
      isReady: true,
      missingRequirements: [],
      warnings: [],
      lastCheckedAt: new Date(),
    });

    await expect(assertSquareMenuPublishAllowed("vendor_1")).resolves.toEqual({ ok: true });
  });

  it("blocks publish when Square connection is unhealthy", async () => {
    vi.mocked(evaluateSquareConnectionHealth).mockResolvedValue({
      provider: "square",
      status: "error",
      isReady: false,
      missingRequirements: ["Reconnect Square"],
      warnings: [],
      lastCheckedAt: new Date(),
    });

    const result = await assertSquareMenuPublishAllowed("vendor_1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/reconnect square/i);
    }
  });
});
