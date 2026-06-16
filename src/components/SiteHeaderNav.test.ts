import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));

const headerNavSrc = readFileSync(join(dir, "SiteHeaderNav.tsx"), "utf8");
const dropdownSrc = readFileSync(join(dir, "AccountHeaderDropdown.tsx"), "utf8");
const menuActionsSrc = readFileSync(join(dir, "account/AccountHeaderMenuActions.tsx"), "utf8");
const roleNavSrc = readFileSync(join(dir, "../lib/auth/role-nav-items.ts"), "utf8");
const signOutFormSrc = readFileSync(join(dir, "auth/CustomerSignOutForm.tsx"), "utf8");
const authProviderSrc = readFileSync(join(dir, "AuthSessionProvider.tsx"), "utf8");
const headerNavContextSrc = readFileSync(join(dir, "../lib/auth/header-nav-context.ts"), "utf8");
const accountActionsSrc = readFileSync(join(dir, "../app/account/actions.ts"), "utf8");
const accountSessionActionsSrc = readFileSync(
  join(dir, "../app/account/AccountSessionActions.tsx"),
  "utf8"
);
const layoutSrc = readFileSync(join(dir, "../app/layout.tsx"), "utf8");

describe("SiteHeaderNav mobile header cart contrast", () => {
  it("keeps compact mobile cart on warm white with charcoal icon in all states", () => {
    expect(headerNavSrc).toMatch(/const headerCompactClass = cn\(\s*headerSecondaryButton/);
    expect(headerNavSrc).toMatch(/text-oo-charcoal lg:hidden/);
    expect(headerNavSrc).toMatch(/shrink-0 text-oo-charcoal/);
    expect(headerNavSrc).not.toMatch(
      /headerCompactClass = cn\([\s\S]{0,280}buttonClassName\(\{ variant: "primary"/
    );
  });

  it("uses orange count badge and cart aria-label with item count", () => {
    expect(headerNavSrc).toMatch(/countBadgeClass = cn\(/);
    expect(headerNavSrc).toMatch(/bg-brand/);
    expect(headerNavSrc).toMatch(
      /itemCount > 0 \? `Cart, \$\{itemCount\} item\$\{itemCount === 1 \? "" : "s"\}` : "Cart"/
    );
    expect(headerNavSrc).toMatch(/aria-label=\{cartLabel\}/);
  });

  it("still hides cart for vendor and pod nav modes", () => {
    expect(roleNavSrc).toMatch(/shouldShowHeaderCart/);
    expect(roleNavSrc).toMatch(/navMode === "vendor"/);
    expect(roleNavSrc).toMatch(/navMode === "pod"/);
  });
});

describe("SiteHeaderNav signed-out pills", () => {
  it("shows business CTA, conditional cart, and Sign in when signed out", () => {
    expect(headerNavSrc).toMatch(/buildRoleNavConfig/);
    expect(headerNavSrc).toMatch(/shouldShowHeaderCart/);
    expect(headerNavSrc).toMatch(/HOME_PRIMARY_CTA_LABEL/);
    expect(headerNavSrc).toMatch(/homePodOwnerMailtoHref/);
    expect(headerNavSrc).toMatch(/Sign in/);
    expect(headerNavSrc).toMatch(/HeaderSignInLink/);
    expect(headerNavSrc).toMatch(/showCart/);
    expect(headerNavSrc).toMatch(/showBusinessCta/);
  });

  it("does not show Orders or Account pills when signed out", () => {
    expect(headerNavSrc).not.toMatch(/href="\/orders"/);
    expect(headerNavSrc).not.toMatch(/>\s*Orders\s*</);
    expect(headerNavSrc).toMatch(/isSignedIn \?/);
    expect(headerNavSrc).toMatch(/AccountHeaderDropdown/);
    expect(headerNavSrc).not.toMatch(/href="\/account"/);
  });

  it("includes a polished mobile sheet with backdrop and grouped nav", () => {
    expect(headerNavSrc).toMatch(/site-mobile-menu/);
    expect(headerNavSrc).toMatch(/lg:hidden/);
    expect(headerNavSrc).toMatch(/createPortal/);
    expect(headerNavSrc).toMatch(/document\.body/);
    expect(headerNavSrc).toMatch(/z-\[80\]/);
    expect(headerNavSrc).toMatch(/z-\[90\]/);
    expect(headerNavSrc).toMatch(/z-\[100\]/);
    expect(headerNavSrc).toMatch(/bg-oo-charcoal\/45 backdrop-blur-sm/);
    expect(headerNavSrc).toMatch(/bg-oo-warm-white p-4 shadow-xl/);
    expect(headerNavSrc).toMatch(/rounded-b-2xl border border-oo-light-stone/);
    expect(headerNavSrc).toMatch(/aria-modal="true"/);
    expect(headerNavSrc).toMatch(/Escape/);
    expect(headerNavSrc).not.toMatch(/z-\[45\]/);
    expect(headerNavSrc).not.toMatch(/bg-oo-charcoal\/95 shadow-\[0_16px_48px/);
  });

  it("uses opaque cream secondary actions for readability", () => {
    expect(headerNavSrc).toMatch(/creamPillBase/);
    expect(headerNavSrc).toMatch(/bg-oo-warm-white shadow-sm/);
    expect(headerNavSrc).not.toMatch(/navPill/);
    expect(headerNavSrc).not.toMatch(/navLinkBase/);
    expect(headerNavSrc).not.toMatch(/SITE_NAV_LINKS/);
    expect(headerNavSrc).not.toMatch(/isSiteNavLinkActive/);
    expect(headerNavSrc).toMatch(/headerSecondaryButton/);
    expect(headerNavSrc).toMatch(/focus-visible:outline-brand/);
    expect(headerNavSrc).not.toMatch(/ring-brand/);
    expect(layoutSrc).toMatch(/bg-oo-charcoal\/40/);
    expect(layoutSrc).toMatch(/backdrop-blur-lg/);
  });
});

describe("SiteHeaderNav signed-in pills", () => {
  it("uses role-based account dropdown without left-side header pills", () => {
    expect(headerNavSrc).toMatch(/buildRoleNavConfig/);
    expect(headerNavSrc).not.toMatch(/navPill/);
    expect(headerNavSrc).not.toMatch(/headerLinks/);
    expect(headerNavSrc).toMatch(/justify-end/);
    expect(headerNavSrc).toMatch(/AccountHeaderDropdown/);
    expect(headerNavSrc).toMatch(/showBusinessCta/);
  });

  it("passes server account menu and dashboard href from layout", () => {
    expect(layoutSrc).toMatch(/accountMenu=\{headerNav\.accountMenu\}/);
    expect(layoutSrc).toMatch(/dashboardHref=\{headerNav\.dashboardHref\}/);
    expect(headerNavSrc).toMatch(/dashboardHref/);
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
  it("builds role-aware actions via shared helper", () => {
    expect(dropdownSrc).toMatch(/buildRoleAccountActions/);
    expect(dropdownSrc).toMatch(/AccountHeaderMenuActions/);
    expect(menuActionsSrc).toMatch(/RoleAccountAction/);
    expect(menuActionsSrc).toMatch(/CustomerSignOutForm/);
  });

  it("uses accessible dropdown trigger", () => {
    expect(dropdownSrc).toMatch(/aria-expanded/);
    expect(dropdownSrc).toMatch(/aria-haspopup="menu"/);
    expect(dropdownSrc).toMatch(/Escape/);
  });

  it("closes after navigation", () => {
    expect(dropdownSrc).toMatch(/onNavigate=\{close\}/);
    expect(menuActionsSrc).toMatch(/onClick=\{onNavigate\}/);
  });

  it("does not close sign-out form before submit starts", () => {
    expect(dropdownSrc).toMatch(/onSignOutStart=\{close\}/);
    expect(menuActionsSrc).toMatch(/onSignOutStart=\{onSignOutStart\}/);
  });

  it("requires server session and account menu", () => {
    expect(dropdownSrc).toMatch(/!hasServerSession \|\| !accountMenu/);
    expect(dropdownSrc).not.toMatch(/useSession/);
  });
});

describe("role-based nav helper", () => {
  it("centralizes guest, customer, vendor, and pod account actions", () => {
    expect(roleNavSrc).toMatch(/buildRoleNavConfig/);
    expect(roleNavSrc).toMatch(/buildRoleAccountActions/);
    expect(roleNavSrc).toMatch(/showBusinessCta/);
    expect(roleNavSrc).toMatch(/Kitchen mode/);
    expect(roleNavSrc).toMatch(/Manage vendors/);
    expect(roleNavSrc).not.toMatch(/headerLinks/);
  });
});

describe("header account menu server context", () => {
  it("builds account menu for signed-in users", () => {
    expect(headerNavContextSrc).toMatch(/accountMenu/);
    expect(headerNavContextSrc).toMatch(/buildHeaderAccountRoleHint/);
    expect(headerNavContextSrc).toMatch(/vendorKitchenHref/);
    expect(headerNavContextSrc).toMatch(/podSettingsHref/);
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
