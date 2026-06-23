import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const adminLayout = readFileSync(join(root, "app/admin/(dashboard)/layout.tsx"), "utf8");
const vendorLayout = readFileSync(join(root, "app/vendor/[vendorId]/layout.tsx"), "utf8");
const podDashboardLayout = readFileSync(join(root, "app/pod/[podId]/dashboard/layout.tsx"), "utf8");

describe("dashboard layout RBAC guards", () => {
  it("admin layout fails closed in production", () => {
    expect(adminLayout).toContain("isAdminDashboardLayoutAuthorized");
    expect(adminLayout).toContain('redirect("/admin/access-denied")');
    expect(adminLayout).not.toMatch(/ADMIN_SECRET/);
  });

  it("vendor layout requires vendor dashboard access outside development", () => {
    expect(vendorLayout).toContain("isVendorDashboardDevOpen");
    expect(vendorLayout).toContain("canAccessVendorDashboard");
    expect(vendorLayout).toContain("buildLoginHrefWithReturn");
    expect(vendorLayout).not.toMatch(/isAuthenticatedSession/);
  });

  it("pod dashboard layout scopes access to pod membership or admin bridge", () => {
    expect(podDashboardLayout).toContain("canAccessPodDashboardLayout");
    expect(podDashboardLayout).toContain('redirect("/admin/access-denied")');
    expect(podDashboardLayout).toContain("buildLoginHrefWithReturn");
  });
});
