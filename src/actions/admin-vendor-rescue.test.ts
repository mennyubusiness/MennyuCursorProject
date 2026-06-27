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

const vendorRescueClient = readFileSync(
  join(process.cwd(), "src/app/admin/(dashboard)/vendors/[vendorId]/AdminVendorRescueClient.tsx"),
  "utf8"
);
const podRescueClient = readFileSync(
  join(process.cwd(), "src/app/admin/(dashboard)/pods/[podId]/AdminPodRescueClient.tsx"),
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
  it("vendor rescue client includes required sections", () => {
    expect(vendorRescueClient).toContain("Ordering controls");
    expect(vendorRescueClient).toContain("Menu / POS status");
    expect(vendorRescueClient).toContain("Menu refresh is not configured yet.");
    expect(vendorRescueClient).toContain("Audit log");
  });

  it("pod rescue client includes QR and roster sections", () => {
    expect(podRescueClient).toContain("QR / public link");
    expect(podRescueClient).toContain("Vendor roster");
    expect(podRescueClient).toContain("Pause pod ordering");
  });

  it("admin layout guards vendor and pod pages", () => {
    expect(layoutSrc).toContain("isAdminDashboardLayoutAuthorized");
  });
});
