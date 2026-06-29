import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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

  it("wires banner into admin layout with server auth check", () => {
    const layout = readSrc("app/admin/layout.tsx");
    expect(layout).toContain("shouldShowAdminModeBanner");
    expect(layout).toContain('<AdminModeBanner />');
    expect(layout).toContain('"admin"');
  });

  it("wires sticky banner into vendor and pod operational layouts", () => {
    const vendorLayout = readSrc("app/vendor/[vendorId]/layout.tsx");
    const podLayout = readSrc("app/pod/[podId]/layout.tsx");

    expect(vendorLayout).toContain('shouldShowAdminModeBanner("operational")');
    expect(vendorLayout).toContain("<AdminModeBanner sticky />");
    expect(podLayout).toContain('shouldShowAdminModeBanner("operational")');
    expect(podLayout).toContain("<AdminModeBanner sticky />");
  });

  it("uses elevated admin detection for operational scope", () => {
    const ctx = readSrc("lib/admin-mode-context.ts");
    expect(ctx).toContain('scope === "admin"');
    expect(ctx).toContain("isPlatformAdmin");
    expect(ctx).toContain("isAdminAllowed");
  });
});

describe("admin entity context navigation", () => {
  it("vendor admin detail includes related navigation links", () => {
    const page = readFileSync(
      join(root, "app/admin/(dashboard)/vendors/[vendorId]/page.tsx"),
      "utf8"
    );
    const nav = readSrc("components/admin/AdminEntityContextNav.tsx");
    expect(page).toContain("AdminVendorContextNav");
    expect(nav).toContain("ADMIN_NAV_LABELS.openVendorDashboard");
    expect(nav).toContain("buildUserAdminPath");
  });

  it("pod admin detail includes related navigation links", () => {
    const page = readFileSync(
      join(root, "app/admin/(dashboard)/pods/[podId]/page.tsx"),
      "utf8"
    );
    const nav = readSrc("components/admin/AdminEntityContextNav.tsx");
    expect(page).toContain("AdminPodContextNav");
    expect(nav).toContain("ADMIN_NAV_LABELS.openPodDashboard");
    expect(nav).toContain("buildVendorAdminPath");
  });

  it("user admin detail includes vendor and pod navigation links", () => {
    const page = readFileSync(
      join(root, "app/admin/(dashboard)/users/[userId]/page.tsx"),
      "utf8"
    );
    expect(page).toContain("AdminUserContextNav");
    const nav = readSrc("components/admin/AdminEntityContextNav.tsx");
    expect(nav).toContain("ADMIN_NAV_LABELS.openVendorAdmin");
    expect(nav).toContain("ADMIN_NAV_LABELS.openPodDashboard");
    expect(nav).toContain("ADMIN_NAV_LABELS.openPublicPage");
  });

  it("uses consistent admin nav labels", () => {
    const labels = readSrc("lib/admin-entity-nav-links.ts");
    expect(labels).toContain('openUserAdmin: "Open user admin"');
    expect(labels).toContain('openVendorAdmin: "Open vendor admin"');
    expect(labels).toContain('openPodAdmin: "Open pod admin"');
  });
});
