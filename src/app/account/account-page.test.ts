import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));

const accountPageSrc = readFileSync(join(dir, "page.tsx"), "utf8");
const linkPhoneCardSrc = readFileSync(join(dir, "AccountLinkPhoneCard.tsx"), "utf8");
const sessionActionsSrc = readFileSync(join(dir, "AccountSessionActions.tsx"), "utf8");
const accountViewModelSrc = readFileSync(join(dir, "../../lib/account-page-view-model.ts"), "utf8");
const accountPathsSrc = readFileSync(join(dir, "../../lib/auth/account-paths.ts"), "utf8");
const headerNavSrc = readFileSync(join(dir, "../../components/SiteHeaderNav.tsx"), "utf8");
const ordersPageSrc = readFileSync(join(dir, "../orders/page.tsx"), "utf8");
const checkoutPhoneSrc = readFileSync(join(dir, "../checkout/CheckoutPhoneVerification.tsx"), "utf8");
const loginFormSrc = readFileSync(join(dir, "../login/LoginForm.tsx"), "utf8");
const orderAccessDeniedSrc = readFileSync(join(dir, "../order/[orderId]/OrderAccessDenied.tsx"), "utf8");

describe("/account signed-out behavior", () => {
  it("redirects to unified sign-in", () => {
    expect(accountPageSrc).toMatch(/redirect\(/);
    expect(accountPageSrc).toMatch(/ACCOUNT_SIGN_IN_PATH/);
    expect(accountPageSrc).not.toMatch(/AccountSignInHub/);
    expect(accountPageSrc).not.toMatch(/Continue with phone/i);
  });
});

describe("/account signed-in behavior", () => {
  it("shows User identity and checkout phone as contact info", () => {
    expect(accountViewModelSrc).toMatch(/checkoutPhone/);
    expect(accountPageSrc).toMatch(/Phone for order updates/);
    expect(accountPageSrc).toMatch(/linkStatusLabel/);
    expect(accountPageSrc).toMatch(/View order history/);
    expect(accountPageSrc).not.toMatch(/View orders with phone/i);
  });

  it("shows link phone card for unlinked checkout session", () => {
    expect(accountPageSrc).toMatch(/AccountLinkPhoneCard/);
    expect(accountPageSrc).toMatch(/canLink/);
    expect(linkPhoneCardSrc).toMatch(/Link checkout phone to this account/);
    expect(linkPhoneCardSrc).toMatch(/\/api\/customer\/account\/link/);
  });

  it("does not show Create account to signed-in users", () => {
    expect(accountPageSrc).not.toMatch(/Create account/);
    expect(accountPageSrc).toMatch(/Use a different email\? Sign out first/);
  });

  it("links to order history and staff tools", () => {
    expect(accountPageSrc).toMatch(/ORDER_HISTORY_PATH/);
    expect(accountPageSrc).toMatch(/Available tools/);
  });
});

describe("header identity slot", () => {
  it("uses Sign in linking to unified login when signed out", () => {
    expect(headerNavSrc).toMatch(/ACCOUNT_SIGN_IN_PATH/);
    expect(headerNavSrc).toMatch(/isSignedIn \?/);
    expect(headerNavSrc).not.toMatch(/hasVerifiedCustomerSession/);
  });

  it("does not show role ticker or competing dashboard links", () => {
    expect(headerNavSrc).not.toMatch(/accountLabel/);
    expect(headerNavSrc).not.toMatch(/Dashboard/);
    expect(headerNavSrc).not.toMatch(/href="\/admin"/);
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
    expect(checkoutPhoneSrc).toMatch(/Phone verified for order updates/);
  });
});

describe("login order history callback copy", () => {
  it("uses order-history subtitle and Sign in button", () => {
    expect(loginFormSrc).toMatch(/Sign in to view your order history/);
    expect(loginFormSrc).toMatch(/"Sign in"/);
    expect(loginFormSrc).not.toMatch(/"Continue"/);
  });
});

describe("order access denied copy", () => {
  it("does not advertise phone lookup", () => {
    expect(orderAccessDeniedSrc).not.toMatch(/look up your orders/i);
    expect(orderAccessDeniedSrc).not.toMatch(/Look up my orders/i);
    expect(orderAccessDeniedSrc).toMatch(/We couldn/);
    expect(orderAccessDeniedSrc).toMatch(/Sign in/);
  });
});

describe("orders empty state linking guidance", () => {
  it("explains account phone linking", () => {
    expect(ordersPageSrc).toMatch(/Link phone to account/);
    expect(ordersPageSrc).toMatch(/Go to account/);
    expect(ordersPageSrc).not.toMatch(/phone-only/i);
  });
});

describe("/account session actions", () => {
  it("signs out via NextAuth and can clear checkout phone separately", () => {
    expect(sessionActionsSrc).toMatch(/signOut\(/);
    expect(sessionActionsSrc).toMatch(/\/api\/customer\/session\/clear/);
    expect(sessionActionsSrc).toMatch(/Clear checkout phone on this device/);
  });
});

describe("route constants", () => {
  it("uses unified login and register paths", () => {
    expect(accountPathsSrc).toMatch(/SIGN_IN_PATH/);
    expect(accountPathsSrc).toMatch(/CUSTOMER_REGISTER_PATH/);
    expect(accountPathsSrc).not.toMatch(/View orders with phone/i);
  });
});
