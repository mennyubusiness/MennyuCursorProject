import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockAuthorized = vi.fn();
const mockReport = vi.fn();

vi.mock("@/lib/admin-auth", () => ({
  isAdminApiRequestAuthorized: (...args: unknown[]) => mockAuthorized(...args),
}));

vi.mock("@/lib/admin-menu-architecture-consistency.server", () => ({
  buildMenuArchitectureConsistencyReport: (...args: unknown[]) => mockReport(...args),
}));

import { GET } from "./route";

describe("GET /api/admin/menu-architecture-consistency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthorized.mockResolvedValue(true);
    mockReport.mockResolvedValue({
      generatedAt: "2026-07-24T00:00:00.000Z",
      vendorId: null,
      findings: [{ code: "consistency_ok", severity: "info", message: "ok" }],
      summary: { errors: 0, warnings: 0, infos: 1 },
    });
  });

  it("returns 403 when admin API authorization fails (unauthenticated / non-admin)", async () => {
    mockAuthorized.mockResolvedValue(false);

    const res = await GET(
      new NextRequest("http://localhost/api/admin/menu-architecture-consistency")
    );
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body).toEqual({ error: "Forbidden" });
    expect(mockReport).not.toHaveBeenCalled();
  });

  it("returns the consistency report for authorized platform-admin / admin bridge callers", async () => {
    const res = await GET(
      new NextRequest("http://localhost/api/admin/menu-architecture-consistency?vendorId=vendor_1")
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockReport).toHaveBeenCalledWith({ vendorId: "vendor_1" });
    expect(body.summary.infos).toBe(1);
    expect(JSON.stringify(body)).not.toMatch(/access_token|refresh_token|password|encrypted/i);
  });
});
