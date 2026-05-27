import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    order: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/session", () => ({
  getCustomerPhoneFromHeaders: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { getCustomerPhoneFromHeaders } from "@/lib/session";
import { assertCustomerOrderAccess } from "./customer-order-access";

describe("assertCustomerOrderAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows matching phone", async () => {
    vi.mocked(getCustomerPhoneFromHeaders).mockReturnValue("+15551234567");
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      id: "ord_1",
      customerPhone: "+15551234567",
    } as never);
    const r = await assertCustomerOrderAccess("ord_1", new Headers());
    expect(r.ok).toBe(true);
  });

  it("denies wrong phone", async () => {
    vi.mocked(getCustomerPhoneFromHeaders).mockReturnValue("+15550000000");
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      id: "ord_1",
      customerPhone: "+15551234567",
    } as never);
    const r = await assertCustomerOrderAccess("ord_1", new Headers());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });
});
