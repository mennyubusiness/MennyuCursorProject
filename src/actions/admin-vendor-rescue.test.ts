import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireAdmin = vi.fn();
const mockPauseVendor = vi.fn();

vi.mock("@/lib/admin-action-context", () => ({
  requireAdminActionContext: (...args: unknown[]) => mockRequireAdmin(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/services/admin-vendor-rescue.service", () => ({
  adminPauseVendorOrdering: (...args: unknown[]) => mockPauseVendor(...args),
  adminUnpauseVendorOrdering: vi.fn(),
  adminHideVendor: vi.fn(),
  adminShowVendor: vi.fn(),
  adminUpdateVendorPublicProfile: vi.fn(),
  adminChangeVendorSlug: vi.fn(),
  adminRestoreVendorSlug: vi.fn(),
  adminAttachVendorToPodFromVendor: vi.fn(),
  adminDetachVendorFromPodFromVendor: vi.fn(),
  adminRefreshVendorMenu: vi.fn(),
  adminLogVendorReadinessRecheck: vi.fn(),
}));

import { adminPauseVendorOrderingAction } from "@/actions/admin-vendor.actions";
import { getVendorOrderabilityInPod } from "@/lib/vendor-orderability-in-pod";

const vendorOverview = readFileSync(
  join(process.cwd(), "src/app/admin/(dashboard)/vendors/[vendorId]/AdminVendorOverview.tsx"),
  "utf8"
);
const vendorDiagnostics = readFileSync(
  join(
    process.cwd(),
    "src/app/admin/(dashboard)/vendors/[vendorId]/AdminVendorTechnicalDiagnostics.tsx"
  ),
  "utf8"
);
const podOverview = readFileSync(
  join(process.cwd(), "src/app/admin/(dashboard)/pods/[podId]/AdminPodOverview.tsx"),
  "utf8"
);
const layoutSrc = readFileSync(join(process.cwd(), "src/app/admin/(dashboard)/layout.tsx"), "utf8");

describe("admin vendor rescue actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-admin callers", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: false, error: "Unauthorized." });
    const result = await adminPauseVendorOrderingAction("vendor_1", "launch support");
    expect(result).toEqual({ ok: false, error: "Unauthorized." });
    expect(mockPauseVendor).not.toHaveBeenCalled();
  });

  it("delegates pause to service when authorized", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, adminUserId: "admin_1" });
    mockPauseVendor.mockResolvedValue({ ok: true, message: "paused" });
    const result = await adminPauseVendorOrderingAction("vendor_1", "launch support");
    expect(result.ok).toBe(true);
    expect(mockPauseVendor).toHaveBeenCalled();
  });
});

describe("orderability pod pause", () => {
  it("blocks ordering when pod is paused", () => {
    const result = getVendorOrderabilityInPod({
      podActive: true,
      podOrdersPaused: true,
      podVendorExists: true,
      podVendorActive: true,
      vendor: { isActive: true, mennyuOrdersPaused: false },
    });
    expect(result.orderable).toBe(false);
    expect(result.reason).toBe("pod_orders_paused");
  });
});

describe("admin rescue UI wiring", () => {
  it("vendor overview includes required management sections", () => {
    expect(vendorOverview).toContain("Ordering controls");
    expect(vendorOverview).toContain("AdminEntityDeleteDangerZone");
    expect(vendorOverview).toContain("adminDeleteVendorProfileAction");
    expect(vendorOverview).toContain("AdminAttentionSection");
    expect(vendorOverview).toContain("Recent activity");
  });

  it("vendor technical diagnostics keep provider tooling", () => {
    expect(vendorDiagnostics).toContain("Menu / Deliverect status");
    expect(vendorDiagnostics).toContain("AdminSquareOrderInjectionDiagnosticsPanel");
    expect(vendorDiagnostics).toContain("Business hours debug");
  });

  it("pod overview includes delete danger zone and roster sections", () => {
    expect(podOverview).toContain("AdminEntityDeleteDangerZone");
    expect(podOverview).toContain("adminDeletePodProfileAction");
    expect(podOverview).toContain("QR / public link");
    expect(podOverview).toContain('id="vendors"');
    expect(podOverview).toContain("Pause pod ordering");
    expect(podOverview).toContain("AdminAttentionSection");
    expect(podOverview).toContain("Technical diagnostics");
    expect(podOverview).toContain("Status overview");
  });

  it("admin layout guards vendor and pod pages", () => {
    expect(layoutSrc).toContain("isAdminDashboardLayoutAuthorized");
  });
});
