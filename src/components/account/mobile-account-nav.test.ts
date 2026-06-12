import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));

const mobileAccountSrc = readFileSync(join(dir, "MobileAccountNavSection.tsx"), "utf8");
const menuActionsSrc = readFileSync(join(dir, "AccountHeaderMenuActions.tsx"), "utf8");
const headerNavSrc = readFileSync(join(dir, "../SiteHeaderNav.tsx"), "utf8");
const dropdownSrc = readFileSync(join(dir, "../AccountHeaderDropdown.tsx"), "utf8");

describe("MobileAccountNavSection", () => {
  it("renders inline account identity and actions without a floating dropdown", () => {
    expect(mobileAccountSrc).toMatch(/aria-label="Account"/);
    expect(mobileAccountSrc).toMatch(/getHeaderAccountDisplayLabel/);
    expect(mobileAccountSrc).toMatch(/AccountHeaderMenuActions/);
    expect(mobileAccountSrc).not.toMatch(/absolute/);
    expect(mobileAccountSrc).not.toMatch(/aria-haspopup/);
    expect(mobileAccountSrc).not.toMatch(/overflow-hidden/);
  });

  it("uses full-width mobile rows with accessible focus styling", () => {
    expect(mobileAccountSrc).toMatch(/min-h-11/);
    expect(mobileAccountSrc).toMatch(/focus-visible:outline-brand/);
    expect(mobileAccountSrc).toMatch(/text-red-800 hover:bg-red-50/);
  });
});

describe("SiteHeaderNav mobile account", () => {
  it("uses inline mobile account section instead of nested dropdown", () => {
    const mobilePortalBlock =
      headerNavSrc.match(/createPortal\([\s\S]*document\.body/)?.[0] ?? "";

    expect(headerNavSrc).toMatch(/MobileAccountNavSection/);
    expect(headerNavSrc).toMatch(/navMode=\{navMode\}/);
    expect(headerNavSrc).toMatch(/dashboardHref=\{dashboardHref\}/);
    expect(mobilePortalBlock).toMatch(/MobileAccountNavSection/);
    expect(mobilePortalBlock).not.toMatch(/AccountHeaderDropdown/);
  });

  it("keeps desktop Account dropdown separate from mobile inline section", () => {
    expect(headerNavSrc).toMatch(/hidden items-center gap-2 lg:flex/);
    expect(headerNavSrc).toMatch(/AccountHeaderDropdown/);
  });
});

describe("AccountHeaderMenuActions shared links", () => {
  it("renders dynamic role-based action lists", () => {
    expect(menuActionsSrc).toMatch(/actions\.filter/);
    expect(menuActionsSrc).toMatch(/CustomerSignOutForm/);
  });

  it("is reused by desktop dropdown with role-aware actions", () => {
    expect(dropdownSrc).toMatch(/AccountHeaderMenuActions/);
    expect(dropdownSrc).toMatch(/buildRoleAccountActions/);
    expect(dropdownSrc).toMatch(/absolute right-0 top-full/);
  });
});
