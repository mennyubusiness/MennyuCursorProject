import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    providerWebhookEvent: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import { logProviderWebhookEvent } from "@/lib/integrations/provider-webhook-event.service";

describe("provider webhook event service", () => {
  beforeEach(() => {
    vi.mocked(prisma.providerWebhookEvent.findUnique).mockReset();
    vi.mocked(prisma.providerWebhookEvent.create).mockReset();
  });

  it("creates new event when externalEventId is new", async () => {
    vi.mocked(prisma.providerWebhookEvent.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.providerWebhookEvent.create).mockResolvedValue({ id: "evt1" } as never);

    const result = await logProviderWebhookEvent({
      provider: "square",
      externalEventId: "sq_evt_123",
      eventType: "order.updated",
      payload: { type: "order.updated", access_token: "secret" },
    });

    expect(result.created).toBe(true);
    expect(result.id).toBe("evt1");
    const createArg = vi.mocked(prisma.providerWebhookEvent.create).mock.calls[0]?.[0];
    expect(createArg?.data.sanitizedPayloadJson).toMatchObject({
      access_token: "[REDACTED]",
    });
  });

  it("is idempotent by provider + externalEventId", async () => {
    vi.mocked(prisma.providerWebhookEvent.findUnique).mockResolvedValue({ id: "existing" } as never);

    const result = await logProviderWebhookEvent({
      provider: "square",
      externalEventId: "sq_evt_123",
      eventType: "order.updated",
    });

    expect(result.created).toBe(false);
    expect(result.id).toBe("existing");
    expect(prisma.providerWebhookEvent.create).not.toHaveBeenCalled();
  });
});
