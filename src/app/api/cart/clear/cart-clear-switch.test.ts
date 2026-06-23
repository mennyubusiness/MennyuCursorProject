import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetSessionId = vi.fn();
const mockClearForSession = vi.fn();
const mockClearActiveSoloSwitch = vi.fn();
const mockAuth = vi.fn();

vi.mock("@/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/session", () => ({
  getSessionIdFromRequest: (...args: unknown[]) => mockGetSessionId(...args),
}));

vi.mock("@/services/cart.service", () => ({
  clearCartForSession: (...args: unknown[]) => mockClearForSession(...args),
  clearActiveSoloCartForSessionSwitch: (...args: unknown[]) => mockClearActiveSoloSwitch(...args),
}));

import { POST } from "./route";

describe("POST /api/cart/clear switchPod", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSessionId.mockReturnValue("sess_1");
    mockAuth.mockResolvedValue(null);
  });

  it("clears solo cart for pod switch", async () => {
    mockClearActiveSoloSwitch.mockResolvedValue({ ok: true });
    const req = new NextRequest("http://localhost/api/cart/clear", {
      method: "POST",
      body: JSON.stringify({ cartId: "cart_1", switchPod: true }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockClearActiveSoloSwitch).toHaveBeenCalledWith("cart_1", "sess_1", {
      authUserId: null,
    });
    expect(mockClearForSession).not.toHaveBeenCalled();
  });

  it("returns 409 when active group blocks switch clear", async () => {
    mockClearActiveSoloSwitch.mockResolvedValue({
      ok: false,
      code: "GROUP_ORDER_ACTIVE",
      message: "Leave or finish your group order before starting a new pod order.",
    });
    const req = new NextRequest("http://localhost/api/cart/clear", {
      method: "POST",
      body: JSON.stringify({ cartId: "cart_1", switchPod: true }),
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("GROUP_ORDER_ACTIVE");
  });
});
