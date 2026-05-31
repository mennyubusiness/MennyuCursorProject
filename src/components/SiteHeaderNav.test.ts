import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));

const headerNavSrc = readFileSync(join(dir, "SiteHeaderNav.tsx"), "utf8");
const dropdownSrc = readFileSync(join(dir, "AccountHeaderDropdown.tsx"), "utf8");
const headerNavContextSrc = readFileSync(join(dir, "../lib/auth/header-nav-context.ts"), "utf8");
const accountActionsSrc = readFileSync(join(dir, "../app/account/actions.ts"), "utf8");
const layoutSrc = readFileSync(join(dir, "../app/layout.tsx"), "utf8");

describe("SiteHeaderNav signed-out pills", () => {
  it("shows Explore, Cart, and Sign in when signed out", () => {
    expect(headerNavSrc).toMatch(/Explore/);
    expect(headerNavSrc).toMatch(/Sign in/);
    expect(headerNavSrc).toMatch(/ACCOUNT_SIGN_IN_PATH/);
    expect(headerNavSrc).toMatch(/showCart/);
  });

  it("does not show Orders or Account pills when signed out", () => {
    expect(headerNavSrc).not.toMatch(/href="\/orders"/);
    expect(headerNavSrc).not.toMatch(/>\s*Orders\s*</);
    expect(headerNavSrc).toMatch(/isSignedIn \?/);
    expect(headerNavSrc).toMatch(/AccountHeaderDropdown/);
    expect(headerNavSrc).not.toMatch(/href="\/account"/);
  });
});

describe("SiteHeaderNav signed-in pills", () => {
  it("shows Explore, Cart, and Account dropdown only", () => {
    expect(headerNavSrc).toMatch(/AccountHeaderDropdown/);
    expect(headerNavSrc).not.toMatch(/>\s*Orders\s*</);
    expect(headerNavSrc).not.toMatch(/href="\/orders"/);
  });

  it("passes server account menu from layout", () => {
    expect(layoutSrc).toMatch(/accountMenu=\{headerNav\.accountMenu\}/);
    expect(headerNavSrc).toMatch(/accountMenu/);
  });
});

describe("AccountHeaderDropdown menu items", () => {
  it("includes identity summary and core links", () => {
    expect(dropdownSrc).toMatch(/View account/);
    expect(dropdownSrc).toMatch(/ACCOUNT_HUB_PATH/);
    expect(dropdownSrc).toMatch(/Order history/);
    expect(dropdownSrc).toMatch(/ORDER_HISTORY_PATH/);
    expect(dropdownSrc).toMatch(/Sign out/);
    expect(dropdownSrc).toMatch(/signOutAccountAction/);
  });

  it("uses accessible dropdown trigger", () => {
    expect(dropdownSrc).toMatch(/aria-expanded/);
    expect(dropdownSrc).toMatch(/aria-haspopup="menu"/);
    expect(dropdownSrc).toMatch(/Escape/);
  });

  it("closes after navigation", () => {
    expect(dropdownSrc).toMatch(/onClick=\{close\}/);
  });

  it("includes optional single-role dashboard links", () => {
    expect(dropdownSrc).toMatch(/Platform admin/);
    expect(dropdownSrc).toMatch(/adminDashboardHref/);
    expect(dropdownSrc).toMatch(/vendorDashboardHref/);
    expect(dropdownSrc).toMatch(/podDashboardHref/);
  });
});

describe("header account menu server context", () => {
  it("builds account menu for signed-in users", () => {
    expect(headerNavContextSrc).toMatch(/accountMenu/);
    expect(headerNavContextSrc).toMatch(/buildHeaderAccountRoleHint/);
    expect(headerNavContextSrc).toMatch(/vendorCount === 1/);
    expect(headerNavContextSrc).toMatch(/podCount === 1/);
  });

  it("does not expose account menu when signed out", () => {
    expect(headerNavContextSrc).toMatch(/accountMenu: null/);
  });
});

describe("header sign-out behavior", () => {
  it("reuses existing server sign-out action", () => {
    expect(accountActionsSrc).toMatch(/signOutAccountAction/);
    expect(accountActionsSrc).toMatch(/signOut\(\{ redirectTo: SIGN_IN_PATH \}\)/);
    expect(dropdownSrc).not.toMatch(/\/api\/customer\/session\/clear/);
  });
});
