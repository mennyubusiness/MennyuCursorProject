import { POST } from "@/app/api/vendor/[vendorId]/customer-ordering-hours/sync/route";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindUnique = vi.fn();
const mockVerifyAccess = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    vendor: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

vi.mock("@/lib/vendor-dashboard-auth", () => ({
  verifyVendorAccessForApi: (...args: unknown[]) => mockVerifyAccess(...args),
}));

describe("POST /api/vendor/[vendorId]/customer-ordering-hours/sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockResolvedValue({
      id: "v1",
      vendorDashboardToken: "tok",
    });
    mockVerifyAccess.mockResolvedValue({ ok: true });
  });

  it("returns 403 when vendor access is denied", async () => {
    mockVerifyAccess.mockResolvedValue({ ok: false });
    const res = await POST(new NextRequest("http://localhost"), {
      params: Promise.resolve({ vendorId: "v1" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns disabled response for vendor sync requests", async () => {
    const res = await POST(new NextRequest("http://localhost"), {
      params: Promise.resolve({ vendorId: "v1" }),
    });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/temporarily unavailable/i);
  });
});
