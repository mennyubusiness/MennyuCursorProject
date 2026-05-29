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

  it("checks customer access before loading order status", () => {
    expect(orderPageSrc).toMatch(/assertCustomerOrderAccess/);
    expect(orderPageSrc).toMatch(/OrderAccessDenied/);
    expect(orderPageSrc).toMatch(/persistCustomerOrderAccessAction/);
  });
});
