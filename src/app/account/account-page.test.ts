import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));

const accountPageSrc = readFileSync(join(dir, "page.tsx"), "utf8");
const accountLayoutSrc = readFileSync(join(dir, "layout.tsx"), "utf8");
const profileCardSrc = readFileSync(join(dir, "AccountProfileCard.tsx"), "utf8");
const phoneSectionSrc = readFileSync(join(dir, "AccountPhoneSection.tsx"), "utf8");
const linkPhoneCardSrc = readFileSync(join(dir, "AccountLinkPhoneCard.tsx"), "utf8");
const recentOrdersSrc = readFileSync(join(dir, "AccountRecentOrders.tsx"), "utf8");
const securityCardSrc = readFileSync(join(dir, "AccountSecurityCard.tsx"), "utf8");
const toolsGridSrc = readFileSync(join(dir, "AccountToolsGrid.tsx"), "utf8");
const signOutSectionSrc = readFileSync(join(dir, "AccountSignOutSection.tsx"), "utf8");
const sessionActionsSrc = readFileSync(join(dir, "AccountSessionActions.tsx"), "utf8");
const actionsSrc = readFileSync(join(dir, "actions.ts"), "utf8");
const accountViewModelSrc = readFileSync(join(dir, "../../lib/account-page-view-model.ts"), "utf8");
const accountPathsSrc = readFileSync(join(dir, "../../lib/auth/account-paths.ts"), "utf8");
const headerNavSrc = readFileSync(join(dir, "../../components/SiteHeaderNav.tsx"), "utf8");
const ordersPageSrc = readFileSync(join(dir, "../orders/page.tsx"), "utf8");
const checkoutPhoneSrc = readFileSync(join(dir, "../checkout/CheckoutPhoneVerification.tsx"), "utf8");
const loginFormSrc = readFileSync(join(dir, "../login/LoginForm.tsx"), "utf8");
const loginActionsSrc = readFileSync(join(dir, "../login/actions.ts"), "utf8");
const headerSignInSrc = readFileSync(join(dir, "../../components/HeaderSignInLink.tsx"), "utf8");
const orderAccessDeniedSrc = readFileSync(join(dir, "../order/[orderId]/OrderAccessDenied.tsx"), "utf8");

describe("/account signed-out behavior", () => {
  it("redirects to unified sign-in", () => {
    expect(accountPageSrc).toMatch(/redirect\(/);
    expect(accountPageSrc).toMatch(/buildLoginHrefWithReturn|ACCOUNT_SIGN_IN_PATH/);
    expect(accountPageSrc).not.toMatch(/AccountSignInHub/);
    expect(accountPageSrc).not.toMatch(/Continue with phone/i);
  });

  it("redirects unsigned users before rendering account content", () => {
    expect(accountPageSrc).toMatch(/if \(!session\?\.user\?\.id/);
    expect(accountPageSrc).toMatch(/redirect\(ACCOUNT_SIGN_IN_PATH\)/);
  });
});

describe("/account hub layout", () => {
  it("uses centered max-width warm layout", () => {
    expect(accountLayoutSrc).toMatch(/max-w-3xl/);
    expect(accountLayoutSrc).toMatch(/#EDE6DC/);
  });

  it("composes hub sections", () => {
    expect(accountPageSrc).toMatch(/AccountHubHeader/);
    expect(accountPageSrc).toMatch(/AccountProfileCard/);
    expect(accountPageSrc).toMatch(/AccountPhoneSection/);
    expect(accountPageSrc).toMatch(/AccountRecentOrders/);
    expect(accountPageSrc).toMatch(/AccountSecurityCard/);
    expect(accountPageSrc).toMatch(/AccountToolsGrid/);
    expect(accountPageSrc).toMatch(/AccountSignOutSection/);
  });

  it("loads recent orders preview", () => {
    expect(accountPageSrc).toMatch(/getOrdersForSignedInUser/);
    expect(accountPageSrc).toMatch(/\.slice\(0, 3\)/);
    expect(recentOrdersSrc).toMatch(/ORDER_HISTORY_PATH/);
  });
});

describe("/account profile", () => {
  it("allows editing display name", () => {
    expect(profileCardSrc).toMatch(/updateAccountNameAction/);
    expect(profileCardSrc).toMatch(/Email sign-in cannot be changed/);
    expect(actionsSrc).toMatch(/updateAccountNameAction/);
  });
});

describe("/account phone for order updates", () => {
  it("shows linked phone and link/add flows", () => {
    expect(phoneSectionSrc).toMatch(/Phone for order updates/);
    expect(phoneSectionSrc).toMatch(/Add phone for order updates/);
    expect(phoneSectionSrc).toMatch(/\/api\/customer\/phone\/send-code/);
    expect(phoneSectionSrc).toMatch(/\/api\/customer\/account\/link/);
    expect(linkPhoneCardSrc).toMatch(/Link phone to account/);
    expect(accountViewModelSrc).toMatch(/linked_other/);
    expect(phoneSectionSrc).toMatch(/already linked to another account/);
  });
});

describe("/account recent orders", () => {
  it("shows empty state with linking guidance", () => {
    expect(recentOrdersSrc).toMatch(/No orders yet/);
    expect(recentOrdersSrc).toMatch(/Link your checkout phone/);
  });
});

describe("/account security", () => {
  it("links to password reset flow", () => {
    expect(securityCardSrc).toMatch(/Change password/);
    expect(securityCardSrc).toMatch(/\/forgot-password/);
  });
});

describe("/account tools by role", () => {
  it("always includes order history tool card", () => {
    expect(toolsGridSrc).toMatch(/Order history/);
    expect(toolsGridSrc).toMatch(/ORDER_HISTORY_PATH/);
  });

  it("includes vendor, pod, and admin tools when staff context exists", () => {
    expect(toolsGridSrc).toMatch(/vendorMemberships/);
    expect(toolsGridSrc).toMatch(/podMemberships/);
    expect(toolsGridSrc).toMatch(/Platform admin/);
    expect(toolsGridSrc).toMatch(/\/admin/);
  });
});

describe("/account session actions", () => {
  it("signs out via server action and can clear checkout phone separately", () => {
    expect(sessionActionsSrc).toMatch(/CustomerSignOutForm/);
    expect(signOutSectionSrc).toMatch(/does not delete your account/);
    expect(sessionActionsSrc).toMatch(/Clear checkout phone on this device/);
  });
});

describe("header identity slot", () => {
  it("uses Sign in linking to unified login when signed out", () => {
    expect(headerNavSrc).toMatch(/HeaderSignInLink/);
    expect(headerNavSrc).toMatch(/isSignedIn \?/);
    expect(headerNavSrc).not.toMatch(/hasVerifiedCustomerSession/);
  });

  it("uses Account dropdown instead of top-level Orders or role ticker", () => {
    expect(headerNavSrc).toMatch(/AccountHeaderDropdown/);
    expect(headerNavSrc).not.toMatch(/>\s*Orders\s*</);
    expect(headerNavSrc).not.toMatch(/href="\/orders"/);
    expect(headerNavSrc).not.toMatch(/accountLabel/);
    expect(headerNavSrc).not.toMatch(/Dashboard/);
  });
});

describe("phone-only history removed", () => {
  it("orders page requires sign-in and has no OTP history", () => {
    expect(ordersPageSrc).not.toMatch(/OrderHistoryPhoneForm/);
    expect(ordersPageSrc).toMatch(/ORDERS_SIGN_IN_PATH/);
  });
});

describe("checkout phone verification copy", () => {
  it("describes phone as order updates not account login", () => {
    expect(checkoutPhoneSrc).toMatch(/Verify your phone for order updates/);
    expect(checkoutPhoneSrc).toMatch(/not for creating an account/i);
  });
});

describe("login order history callback copy", () => {
  it("uses order-history subtitle and Sign in button", () => {
    expect(loginFormSrc).toMatch(/Sign in to view your order history/);
    expect(loginFormSrc).toMatch(/"Sign in"/);
  });
});

describe("login session establishment", () => {
  it("waits for client session before resolving destination", () => {
    expect(loginFormSrc).toMatch(/await getSession\(\)/);
    expect(loginFormSrc).toMatch(/readLoginReturnParam/);
    expect(loginFormSrc).toMatch(/resolvePostLoginDestinationAction/);
    expect(loginFormSrc).toMatch(/router\.replace/);
  });

  it("header sign-in passes current path as next", () => {
    expect(headerSignInSrc).toMatch(/buildLoginHrefFromLocation/);
    expect(headerSignInSrc).toMatch(/usePathname/);
  });

  it("revalidates layout after credentials sign-in", () => {
    expect(loginActionsSrc).toMatch(/revalidatePath\("\/", "layout"\)/);
  });

  it("uses next param for protected sign-in links", () => {
    expect(accountPathsSrc).toMatch(/buildLoginHrefWithReturn\("\/account"\)/);
    expect(accountPathsSrc).toMatch(/buildLoginHrefWithReturn\("\/orders"\)/);
    expect(ordersPageSrc).toMatch(/ORDERS_SIGN_IN_PATH/);
  });
});

describe("route constants", () => {
  it("uses unified login and register paths", () => {
    expect(accountPathsSrc).toMatch(/SIGN_IN_PATH/);
    expect(accountPathsSrc).toMatch(/CUSTOMER_REGISTER_PATH/);
  });
});
