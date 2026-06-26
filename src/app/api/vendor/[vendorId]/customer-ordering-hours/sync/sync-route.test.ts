import { POST } from "@/app/api/vendor/[vendorId]/customer-ordering-hours/sync/route";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindUnique = vi.fn();
const mockVerifyAccess = vi.fn();
const mockSync = vi.fn();

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

vi.mock("@/services/vendor-deliverect-hours-sync.service", () => ({
  syncVendorCustomerOrderingHoursFromDeliverect: (...args: unknown[]) => mockSync(...args),
}));

describe("POST /api/vendor/[vendorId]/customer-ordering-hours/sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockResolvedValue({
      id: "v1",
      vendorDashboardToken: "tok",
      syncCustomerOrderingHoursFromDeliverect: true,
      deliverectChannelLinkId: "cl1",
      posConnectionStatus: "connected",
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

  it("returns 400 when sync from Deliverect is disabled", async () => {
    mockFindUnique.mockResolvedValue({
      id: "v1",
      vendorDashboardToken: "tok",
      syncCustomerOrderingHoursFromDeliverect: false,
      deliverectChannelLinkId: "cl1",
      posConnectionStatus: "connected",
    });
    const res = await POST(new NextRequest("http://localhost"), {
      params: Promise.resolve({ vendorId: "v1" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns success payload when sync succeeds", async () => {
    mockSync.mockResolvedValue({
      ok: true,
      syncedAt: "2026-06-04T12:00:00.000Z",
      hadPreviousHours: false,
    });
    const res = await POST(new NextRequest("http://localhost"), {
      params: Promise.resolve({ vendorId: "v1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.syncedAt).toBe("2026-06-04T12:00:00.000Z");
  });

  it("returns 502 with keptPreviousHours when sync fails", async () => {
    mockSync.mockResolvedValue({
      ok: false,
      error: "Deliverect hours fetch failed",
      keptPreviousHours: true,
    });
    const res = await POST(new NextRequest("http://localhost"), {
      params: Promise.resolve({ vendorId: "v1" }),
    });
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.keptPreviousHours).toBe(true);
  });
});
