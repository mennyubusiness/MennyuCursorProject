import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));

const orderPageContentSrc = readFileSync(join(dir, "OrderPageContent.tsx"), "utf8");
const orderResumePaymentSrc = readFileSync(join(dir, "OrderResumePayment.tsx"), "utf8");
const orderPageSrc = readFileSync(join(dir, "page.tsx"), "utf8");

describe("customer order page access hardening", () => {
  it("does not bootstrap phone cookie from public order view", () => {
    expect(orderPageContentSrc).not.toMatch(/SetCustomerPhoneFromOrder/);
    expect(orderResumePaymentSrc).not.toMatch(/SetCustomerPhoneFromOrder/);
    expect(orderResumePaymentSrc).not.toMatch(/PhoneCookieSyncRefresh/);
  });

  it("does not set cookies during Server Component render", () => {
    expect(orderPageSrc).not.toMatch(/persistCustomerOrderAccessAction/);
    expect(orderPageSrc).not.toMatch(/cookies\(\)\.set/);
    expect(orderPageSrc).not.toMatch(/persistCustomerOrderAccessCookies/);
  });

  it("redirects signed access links to bootstrap route handler", () => {
    expect(orderPageSrc).toMatch(/\/api\/orders\/\$\{orderId\}\/access/);
    expect(orderPageSrc).toMatch(/access\?\.trim\(\)/);
  });

  it("checks customer access before loading order status", () => {
    expect(orderPageSrc).toMatch(/assertCustomerOrderAccess/);
    expect(orderPageSrc).toMatch(/OrderAccessDenied/);
  });
});

describe("signed order access URL flows", () => {
  const checkoutPaymentSrc = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../../checkout/CheckoutPaymentStep.tsx"),
    "utf8"
  );
  const tokenSrc = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../../../lib/customer-order-access-token.ts"),
    "utf8"
  );

  it("SMS order status links still use /order/{id}?access=", () => {
    expect(tokenSrc).toMatch(/\/order\/\$\{orderId\}\?\$\{ORDER_ACCESS_QUERY_PARAM\}/);
  });

  it("checkout Stripe return_url still includes access query param", () => {
    expect(checkoutPaymentSrc).toMatch(/access:\s*orderAccessToken/);
    expect(checkoutPaymentSrc).toMatch(/\/order\/\$\{orderId\}\?\$\{returnParams\.toString\(\)\}/);
  });
});
