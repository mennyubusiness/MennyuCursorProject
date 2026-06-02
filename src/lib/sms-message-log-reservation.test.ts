import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindUnique = vi.fn();
const mockCreate = vi.fn();
const mockUpdateMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    smsMessageLog: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
    },
  },
}));

import { reserveSmsMessageLog } from "@/lib/sms-message-log-reservation";

const baseInput = {
  orderId: "ord_1",
  toMasked: "+1***4567",
  toLast4: "4567",
  eventType: "ORDER_RECEIVED",
  body: "Open Order: test",
  status: "pending",
  idempotencyKey: "sms:ORDER_RECEIVED:ord_1",
};

describe("reserveSmsMessageLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "log_1" });
    mockUpdateMany.mockResolvedValue({ count: 0 });
  });

  it("creates pending reservation on first call", async () => {
    const result = await reserveSmsMessageLog(baseInput);
    expect(result).toEqual({ outcome: "proceed", logId: "log_1" });
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("returns duplicate when key already committed", async () => {
    mockCreate.mockRejectedValueOnce({ code: "P2002" });
    mockFindUnique.mockResolvedValueOnce({
      id: "log_existing",
      status: "queued",
      providerMessageId: "SM1",
    });

    const result = await reserveSmsMessageLog(baseInput);
    expect(result).toEqual({
      outcome: "duplicate",
      status: "queued",
      providerMessageId: "SM1",
      reason: "duplicate_idempotency_key",
    });
  });

  it("returns in-flight duplicate for pending row", async () => {
    mockCreate.mockRejectedValueOnce({ code: "P2002" });
    mockFindUnique.mockResolvedValueOnce({
      id: "log_pending",
      status: "pending",
      providerMessageId: null,
    });

    const result = await reserveSmsMessageLog(baseInput);
    expect(result.outcome).toBe("duplicate");
    if (result.outcome === "duplicate") {
      expect(result.reason).toBe("duplicate_in_flight");
    }
  });

  it("reclaims failed row for intentional retry", async () => {
    mockCreate.mockRejectedValueOnce({ code: "P2002" });
    mockFindUnique.mockResolvedValueOnce({
      id: "log_failed",
      status: "failed",
      providerMessageId: null,
    });
    mockUpdateMany.mockResolvedValueOnce({ count: 1 });

    const result = await reserveSmsMessageLog(baseInput);
    expect(result).toEqual({ outcome: "proceed", logId: "log_failed" });
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "log_failed", status: "failed" },
      })
    );
  });
});
