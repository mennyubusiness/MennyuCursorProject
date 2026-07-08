import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  getVendorMenuManagementMode,
  vendorMenuManagementNavLabel,
  vendorMenuManagementPath,
} from "@/lib/vendor-menu-management";

const vendorDir = dirname(fileURLToPath(import.meta.url));

function readVendor(relativePath: string): string {
  return readFileSync(join(vendorDir, relativePath), "utf8");
}

describe("vendor menu management UX", () => {
  it("manual_dashboard vendors use Menu Builder nav and path", () => {
    expect(getVendorMenuManagementMode("manual_dashboard")).toBe("builder");
    expect(vendorMenuManagementNavLabel("manual_dashboard")).toBe("Menu Builder");
    expect(vendorMenuManagementPath("v1", "manual_dashboard")).toBe("/vendor/v1/menu-builder");

    const nav = readVendor("VendorAreaNav.tsx");
    expect(nav).toContain("vendorMenuManagementNavLabel");
    expect(nav).toContain("vendorMenuManagementPath");
    expect(nav).not.toContain("vendorMenuSourceNavLabel");
  });

  it("deliverect vendors use Menu Imports nav and path", () => {
    expect(getVendorMenuManagementMode("deliverect")).toBe("imports");
    expect(vendorMenuManagementNavLabel("deliverect")).toBe("Menu Imports");
    expect(vendorMenuManagementPath("v1", "deliverect")).toBe("/vendor/v1/menu/imports");
  });

  it("square vendors use Menu Imports even when menuSource stays open_order", () => {
    expect(getVendorMenuManagementMode("square")).toBe("imports");
    expect(vendorMenuManagementNavLabel("square")).toBe("Menu Imports");
    expect(vendorMenuManagementPath("v1", "square")).toBe("/vendor/v1/menu/imports");
  });

  it("menu builder page redirects integrated vendors via route guard", () => {
    const builderPage = readVendor("menu-builder/page.tsx");
    const guard = readFileSync(
      join(vendorDir, "../../../lib/vendor-menu-route-guard.server.ts"),
      "utf8"
    );
    expect(builderPage).toContain("gateOpenOrderMenuBuilderRoutes");
    expect(guard).toContain("vendorMenuManagementPath");
  });

  it("generic menu imports page renders provider panels", () => {
    const importsPage = readVendor("menu/imports/page.tsx");
    expect(importsPage).toContain("Menu Imports");
    expect(importsPage).toContain("VendorDeliverectMenuImportsPanel");
    expect(importsPage).toContain("VendorSquareMenuImportsPanel");
  });

  it("legacy menu-imports list redirects to menu/imports", () => {
    const legacy = readVendor("menu-imports/page.tsx");
    expect(legacy).toContain("vendorMenuManagementPath");
    expect(legacy).toContain("redirect");
  });

  it("square panel shows connect prompt when Square is not connected", () => {
    const squarePanel = readFileSync(
      join(vendorDir, "../../../components/vendor/menu-imports/VendorSquareMenuImportsPanel.tsx"),
      "utf8"
    );
    expect(squarePanel).toContain("Connect Square before importing");
    expect(squarePanel).not.toContain("SQUARE_OAUTH_REDIRECT_URL uses production domain");
    expect(squarePanel).toContain("Open Square integration");
    expect(squarePanel).toContain("!squareStatus.hasConnection");
    expect(squarePanel).not.toContain("coming next");
  });

  it("square panel shows preview/import controls when Square is connected", () => {
    const squarePanel = readFileSync(
      join(vendorDir, "../../../components/vendor/menu-imports/VendorSquareMenuImportsPanel.tsx"),
      "utf8"
    );
    const controls = readFileSync(
      join(vendorDir, "../../../components/vendor/VendorSquareCatalogCard.tsx"),
      "utf8"
    );
    expect(squarePanel).toContain("VendorSquareCatalogImportControls");
    expect(squarePanel).toContain("squareStatus.hasConnection");
    expect(controls).toContain("Preview Square catalog");
    expect(controls).toContain("Import Square catalog");
  });

  it("square catalog import controls link to draft review after import", () => {
    const controls = readFileSync(
      join(vendorDir, "../../../components/vendor/VendorSquareCatalogCard.tsx"),
      "utf8"
    );
    expect(controls).toContain("menu-imports/${importReport.jobId}");
    expect(controls).toContain("Preview and publish menu");
  });

  it("square panel includes grouped draft menu preview and publish action", () => {
    const squarePanel = readFileSync(
      join(vendorDir, "../../../components/vendor/menu-imports/VendorSquareMenuImportsPanel.tsx"),
      "utf8"
    );
    expect(squarePanel).toContain("MenuImportMenuPreview");
    expect(squarePanel).toContain("Draft menu preview");
    expect(squarePanel).toContain("MenuImportPublishPanel");
    expect(squarePanel).toContain("Publish imported menu");
    expect(squarePanel).toContain("VendorMenuImportsJobTable");
  });

  it("square integration page links to Menu Imports for catalog import", () => {
    const squareIntegration = readVendor("integrations/square/page.tsx");
    expect(squareIntegration).toContain("Manage Square menu import");
    expect(squareIntegration).toContain("/menu/imports");
    expect(squareIntegration).not.toContain("VendorSquareCatalogCard");
  });

  it("admin vendor detail shows menu management mode", () => {
    const admin = readFileSync(
      join(vendorDir, "../../../app/admin/(dashboard)/vendors/[vendorId]/AdminVendorRescueClient.tsx"),
      "utf8"
    );
    expect(admin).toContain("Menu management");
    expect(admin).toContain("vendorMenuManagementModeLabel");
  });
});
