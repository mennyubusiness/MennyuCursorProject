import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));

const pageSrc = readFileSync(join(dir, "page.tsx"), "utf8");
const viewSrc = readFileSync(join(dir, "VendorMenuPageView.tsx"), "utf8");
const headerSrc = readFileSync(join(dir, "VendorMenuHeaderActions.tsx"), "utf8");
const browserSrc = readFileSync(join(dir, "VendorMenuItemBrowser.tsx"), "utf8");

describe("vendor menu page workspace", () => {
  it("loads page data through server loader", () => {
    expect(pageSrc).toMatch(/loadVendorMenuPageData/);
    expect(pageSrc).toMatch(/VendorMenuPageView/);
    expect(pageSrc).toMatch(/gateDeliverectMenuRoutes/);
  });

  it("shows live menu summary and latest import cards", () => {
    expect(viewSrc).toMatch(/Current live menu/);
    expect(viewSrc).toMatch(/Latest import/);
    expect(viewSrc).toMatch(/No published menu/);
    expect(viewSrc).toMatch(/No unpublished menu import/);
  });

  it("exposes publish workflow and import history links", () => {
    expect(viewSrc).toMatch(/MenuImportPublishPanel/);
    expect(viewSrc).toMatch(/Review changes/);
    expect(headerSrc).toMatch(/View import history/);
    expect(headerSrc).toMatch(/Review latest import/);
  });

  it("renders searchable current menu browser", () => {
    expect(browserSrc).toMatch(/VendorMenuItemBrowser/);
    expect(browserSrc).toMatch(/Search items/);
    expect(browserSrc).toMatch(/filterVendorMenuDisplayItems/);
  });

  it("shows admin-only Deliverect pull when allowed", () => {
    expect(headerSrc).toMatch(/Pull latest from Deliverect/);
    expect(headerSrc).toMatch(/canAdminPull/);
  });
});
