import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindFirst = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    smsMessageLog: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

import { applyTwilioSmsStatusCallback, mapTwilioStatusToLogStatus } from "@/services/sms-status-update.service";

describe("sms-status-update.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindFirst.mockResolvedValue({ id: "log_1", status: "sent" });
    mockUpdate.mockResolvedValue({});
  });

  it("maps Twilio statuses", () => {
    expect(mapTwilioStatusToLogStatus("delivered")).toBe("delivered");
    expect(mapTwilioStatusToLogStatus("undelivered")).toBe("undelivered");
    expect(mapTwilioStatusToLogStatus("failed")).toBe("failed");
  });

  it("updates log row by MessageSid", async () => {
    const result = await applyTwilioSmsStatusCallback({
      messageSid: "SM123",
      messageStatus: "delivered",
      to: "+15551234567",
    });
    expect(result.updated).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "log_1" },
        data: expect.objectContaining({ status: "delivered" }),
      })
    );
  });

  it("returns updated false when no log row", async () => {
    mockFindFirst.mockResolvedValue(null);
    const result = await applyTwilioSmsStatusCallback({
      messageSid: "SM_missing",
      messageStatus: "delivered",
    });
    expect(result.updated).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
