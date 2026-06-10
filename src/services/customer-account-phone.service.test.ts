import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCustomerAccountFindFirst = vi.fn();
const mockCustomerAccountUpdate = vi.fn();
const mockRecordSmsOptOut = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    customerAccount: {
      findFirst: (...args: unknown[]) => mockCustomerAccountFindFirst(...args),
      update: (...args: unknown[]) => mockCustomerAccountUpdate(...args),
    },
  },
}));

vi.mock("@/lib/sms-opt-out.service", () => ({
  recordSmsOptOut: (...args: unknown[]) => mockRecordSmsOptOut(...args),
}));

import { removePhoneFromUserAccount } from "./customer-account-phone.service";

describe("removePhoneFromUserAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCustomerAccountUpdate.mockResolvedValue({});
    mockRecordSmsOptOut.mockResolvedValue(undefined);
  });

  it("unlinks account phone and opts out of SMS", async () => {
    mockCustomerAccountFindFirst.mockResolvedValue({
      id: "ca_1",
      phoneE164: "+15551234567",
    });

    const result = await removePhoneFromUserAccount("user_1");

    expect(result).toEqual({ ok: true, removedPhoneE164: "+15551234567" });
    expect(mockCustomerAccountUpdate).toHaveBeenCalledWith({
      where: { id: "ca_1" },
      data: { userId: null },
    });
    expect(mockRecordSmsOptOut).toHaveBeenCalledWith("+15551234567");
  });

  it("returns ok when user has no linked phone", async () => {
    mockCustomerAccountFindFirst.mockResolvedValue(null);

    const result = await removePhoneFromUserAccount("user_1");

    expect(result).toEqual({ ok: true, removedPhoneE164: null });
    expect(mockCustomerAccountUpdate).not.toHaveBeenCalled();
    expect(mockRecordSmsOptOut).not.toHaveBeenCalled();
  });
});
