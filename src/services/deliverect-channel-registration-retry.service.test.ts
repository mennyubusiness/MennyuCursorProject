import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    webhookEvent: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import {
  hasUnmatchedChannelRegistrationForVendor,
  retryChannelRegistrationMatchForWebhookEvent,
} from "./deliverect-channel-registration-retry.service";

describe("hasUnmatchedChannelRegistrationForVendor", () => {
  beforeEach(() => {
    vi.mocked(prisma.webhookEvent.findMany).mockReset();
  });

  it("returns true when a no_match event targets the vendor id in channelLocationId", async () => {
    vi.mocked(prisma.webhookEvent.findMany).mockResolvedValue([
      {
        payload: { channelLocationId: "vendor-a", channelLinkId: "cl1" },
        errorMessage: "no_match|keys=status",
      },
    ] as never);

    await expect(hasUnmatchedChannelRegistrationForVendor(prisma, "vendor-a")).resolves.toBe(true);
  });

  it("returns false when no_match has different channelLocationId", async () => {
    vi.mocked(prisma.webhookEvent.findMany).mockResolvedValue([
      {
        payload: { channelLocationId: "other", channelLinkId: "cl1" },
        errorMessage: "no_match|keys=status",
      },
    ] as never);

    await expect(hasUnmatchedChannelRegistrationForVendor(prisma, "vendor-a")).resolves.toBe(false);
  });
});

describe("retryChannelRegistrationMatchForWebhookEvent", () => {
  beforeEach(() => {
    vi.mocked(prisma.webhookEvent.findUnique).mockReset();
    vi.mocked(prisma.webhookEvent.update).mockReset();
  });

  it("returns error when webhook not found", async () => {
    vi.mocked(prisma.webhookEvent.findUnique).mockResolvedValue(null);

    await expect(retryChannelRegistrationMatchForWebhookEvent(prisma, "missing")).resolves.toEqual({
      ok: false,
      error: "Webhook event not found.",
    });
  });
});
