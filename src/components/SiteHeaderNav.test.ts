import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));

const headerNavSrc = readFileSync(join(dir, "SiteHeaderNav.tsx"), "utf8");
const dropdownSrc = readFileSync(join(dir, "AccountHeaderDropdown.tsx"), "utf8");
const signOutFormSrc = readFileSync(join(dir, "auth/CustomerSignOutForm.tsx"), "utf8");
const authProviderSrc = readFileSync(join(dir, "AuthSessionProvider.tsx"), "utf8");
const headerNavContextSrc = readFileSync(join(dir, "../lib/auth/header-nav-context.ts"), "utf8");
const accountActionsSrc = readFileSync(join(dir, "../app/account/actions.ts"), "utf8");
const accountSessionActionsSrc = readFileSync(
  join(dir, "../app/account/AccountSessionActions.tsx"),
  "utf8"
);
const layoutSrc = readFileSync(join(dir, "../app/layout.tsx"), "utf8");

describe("SiteHeaderNav signed-out pills", () => {
  it("shows marketing nav, business CTA, Cart, and Sign in when signed out", () => {
    expect(headerNavSrc).toMatch(/SITE_NAV_LINKS/);
    expect(headerNavSrc).toMatch(/isSiteNavLinkActive/);
    expect(headerNavSrc).toMatch(/HOME_PRIMARY_CTA_LABEL/);
    expect(headerNavSrc).toMatch(/homePodOwnerMailtoHref/);
    expect(headerNavSrc).toMatch(/Sign in/);
    expect(headerNavSrc).toMatch(/HeaderSignInLink/);
    expect(headerNavSrc).toMatch(/showCart/);
    expect(headerNavSrc).toMatch(/prominentCart/);
  });

  it("does not show Orders or Account pills when signed out", () => {
    expect(headerNavSrc).not.toMatch(/href="\/orders"/);
    expect(headerNavSrc).not.toMatch(/>\s*Orders\s*</);
    expect(headerNavSrc).toMatch(/isSignedIn \?/);
    expect(headerNavSrc).toMatch(/AccountHeaderDropdown/);
    expect(headerNavSrc).not.toMatch(/href="\/account"/);
  });

  it("includes a mobile menu with business CTA", () => {
    expect(headerNavSrc).toMatch(/site-mobile-menu/);
    expect(headerNavSrc).toMatch(/lg:hidden/);
  });

  it("uses filled cream nav pill and secondary actions for readability", () => {
    expect(headerNavSrc).toMatch(/creamPillBase|bg-oo-warm-white\/90/);
    expect(headerNavSrc).toMatch(/navLinkActive/);
    expect(headerNavSrc).toMatch(/bg-oo-charcoal font-semibold text-oo-warm-white/);
    expect(headerNavSrc).toMatch(/headerSecondaryButton/);
    expect(headerNavSrc).toMatch(/focus-visible:outline-brand/);
    expect(headerNavSrc).not.toMatch(/ring-brand/);
    expect(layoutSrc).toMatch(/bg-oo-charcoal\/40/);
    expect(layoutSrc).toMatch(/backdrop-blur-lg/);
  });
});

describe("SiteHeaderNav signed-in pills", () => {
  it("shows marketing nav, business CTA, Cart, and Account dropdown", () => {
    expect(headerNavSrc).toMatch(/SITE_NAV_LINKS/);
    expect(headerNavSrc).toMatch(/HOME_PRIMARY_CTA_LABEL/);
    expect(headerNavSrc).toMatch(/AccountHeaderDropdown/);
    expect(headerNavSrc).not.toMatch(/>\s*Orders\s*</);
    expect(headerNavSrc).not.toMatch(/href="\/orders"/);
  });

  it("passes server account menu from layout", () => {
    expect(layoutSrc).toMatch(/accountMenu=\{headerNav\.accountMenu\}/);
    expect(headerNavSrc).toMatch(/accountMenu/);
  });

  it("uses server session as auth source of truth for header", () => {
    expect(headerNavSrc).toMatch(/const isSignedIn = hasServerSession;/);
    expect(headerNavSrc).not.toMatch(/status === "authenticated"/);
    expect(headerNavSrc).toMatch(/hasServerSession=\{hasServerSession\}/);
  });
});

describe("AuthSessionProvider stale session sync", () => {
  it("clears client session only after server session was present then removed", () => {
    expect(authProviderSrc).toMatch(/hadServerSessionRef/);
    expect(authProviderSrc).toMatch(
      /if \(hadServerSession && !hasServerSession && status === "authenticated"\)/
    );
    expect(authProviderSrc).toMatch(/signOut\(\{ redirect: false \}\)/);
    expect(layoutSrc).toMatch(/hasServerSession=\{hasServerSession\}/);
  });
});

describe("AccountHeaderDropdown menu items", () => {
  it("includes identity summary and core links", () => {
    expect(dropdownSrc).toMatch(/View account/);
    expect(dropdownSrc).toMatch(/ACCOUNT_HUB_PATH/);
    expect(dropdownSrc).toMatch(/Order history/);
    expect(dropdownSrc).toMatch(/ORDER_HISTORY_PATH/);
    expect(dropdownSrc).toMatch(/CustomerSignOutForm/);
  });

  it("uses accessible dropdown trigger", () => {
    expect(dropdownSrc).toMatch(/aria-expanded/);
    expect(dropdownSrc).toMatch(/aria-haspopup="menu"/);
    expect(dropdownSrc).toMatch(/Escape/);
  });

  it("closes after navigation", () => {
    expect(dropdownSrc).toMatch(/onClick=\{close\}/);
  });

  it("does not close sign-out form before submit starts", () => {
    expect(dropdownSrc).toMatch(/onSignOutStart=\{close\}/);
    expect(dropdownSrc).not.toMatch(/onClick=\{close\}[\s\S]*Sign out/);
  });

  it("requires server session and account menu", () => {
    expect(dropdownSrc).toMatch(/!hasServerSession \|\| !accountMenu/);
    expect(dropdownSrc).not.toMatch(/useSession/);
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

describe("shared customer sign-out path", () => {
  it("uses one server action for account page and header dropdown", () => {
    expect(signOutFormSrc).toMatch(/signOutAccountAction/);
    expect(accountSessionActionsSrc).toMatch(/CustomerSignOutForm/);
    expect(accountActionsSrc).toMatch(/signOutAccountAction/);
    expect(accountActionsSrc).toMatch(/revalidatePath\("\/", "layout"\)/);
    expect(accountActionsSrc).toMatch(/signOut\(\{ redirectTo: SIGN_IN_PATH \}\)/);
    expect(dropdownSrc).not.toMatch(/\/api\/customer\/session\/clear/);
  });

  it("closes dropdown only after sign-out submit is pending", () => {
    expect(signOutFormSrc).toMatch(/onSignOutStart/);
    expect(signOutFormSrc).toMatch(/if \(pending\) onSignOutStart/);
  });
});
