import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isPodElevatedDashboardPath,
  isVendorElevatedDashboardPath,
} from "@/lib/admin-mode-banner-paths";

const root = join(process.cwd(), "src");

function readSrc(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

describe("admin mode banner", () => {
  it("renders amber admin marquee with accessible label", () => {
    const banner = readSrc("components/admin/AdminModeBanner.tsx");
    const marquee = readSrc("components/admin/MarqueeBanner.tsx");

    expect(banner).toContain('tone="admin"');
    expect(banner).toContain("ADMIN MODE");
    expect(banner).toContain('ariaLabel="Admin mode. You are using admin controls."');
    expect(marquee).toContain("motion-reduce:hidden");
    expect(marquee).toContain("motion-reduce:block");
    expect(marquee).toContain("sr-only");
  });

  it("does not render banner in admin layout", () => {
    const layout = readSrc("app/admin/layout.tsx");
    expect(layout).not.toContain("AdminModeBanner");
    expect(layout).not.toContain("shouldShowAdminModeBanner");
  });

  it("wires sticky banner into vendor and pod operational layouts with path checks", () => {
    const vendorLayout = readSrc("app/vendor/[vendorId]/layout.tsx");
    const podLayout = readSrc("app/pod/[podId]/layout.tsx");

    expect(vendorLayout).toContain("shouldShowAdminModeBannerForVendor");
    expect(vendorLayout).toContain("<AdminModeBanner sticky />");
    expect(podLayout).toContain("shouldShowAdminModeBannerForPod");
    expect(podLayout).toContain("<AdminModeBanner sticky />");
  });

  it("uses elevated admin detection separate from admin shell", () => {
    const ctx = readSrc("lib/admin-mode-context.ts");
    expect(ctx).toContain("isElevatedAdminAccess");
    expect(ctx).toContain("isPlatformAdmin");
    expect(ctx).toContain("isAdminAllowed");
    expect(ctx).not.toContain('scope === "admin"');
  });

  it("limits pod banner to operator dashboard routes", () => {
    const podId = "pod-123";
    expect(isPodElevatedDashboardPath(`/pod/${podId}/dashboard`, podId)).toBe(true);
    expect(isPodElevatedDashboardPath(`/pod/${podId}/settings`, podId)).toBe(true);
    expect(isPodElevatedDashboardPath(`/pod/${podId}/vendor/vendor-1`, podId)).toBe(false);
    expect(isPodElevatedDashboardPath(`/p/my-pod`, podId)).toBe(false);
  });

  it("limits vendor banner to vendor operator routes", () => {
    const vendorId = "vendor-456";
    expect(isVendorElevatedDashboardPath(`/vendor/${vendorId}/dashboard`, vendorId)).toBe(true);
    expect(isVendorElevatedDashboardPath(`/vendor/${vendorId}/kitchen`, vendorId)).toBe(true);
    expect(isVendorElevatedDashboardPath(`/p/my-pod/v/my-vendor`, vendorId)).toBe(false);
  });
});

describe("admin pod detail navigation", () => {
  it("does not render standalone related navigation on pod admin detail", () => {
    const page = readFileSync(
      join(root, "app/admin/(dashboard)/pods/[podId]/page.tsx"),
      "utf8"
    );
    expect(page).not.toContain("AdminPodContextNav");
    expect(page).not.toContain("AdminEntityContextNav");
  });

  it("places pod dashboard link in overview primary actions", () => {
    const overview = readSrc("app/admin/(dashboard)/pods/[podId]/AdminPodOverview.tsx");
    expect(overview).toContain("summary.links.podDashboard");
    expect(overview).toContain("Open pod dashboard");
    expect(overview).not.toContain("AdminPodContextNav");
  });

  it("does not render standalone related navigation on vendor or user admin detail", () => {
    const vendorPage = readFileSync(
      join(root, "app/admin/(dashboard)/vendors/[vendorId]/page.tsx"),
      "utf8"
    );
    const userPage = readFileSync(
      join(root, "app/admin/(dashboard)/users/[userId]/page.tsx"),
      "utf8"
    );
    expect(vendorPage).not.toContain("AdminVendorContextNav");
    expect(userPage).not.toContain("AdminUserContextNav");
  });

  it("uses consistent admin nav labels", () => {
    const labels = readSrc("lib/admin-entity-nav-links.ts");
    expect(labels).toContain('openUserAdmin: "Open user admin"');
    expect(labels).toContain('openVendorAdmin: "Open vendor admin"');
    expect(labels).toContain('openPodAdmin: "Open pod admin"');
    expect(labels).toContain('openPodDashboard: "Open pod dashboard"');
  });
});
