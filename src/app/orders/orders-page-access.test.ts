import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));

const ordersPageSrc = readFileSync(join(dir, "page.tsx"), "utf8");
const orderActionsSrc = readFileSync(join(dir, "../../actions/order.actions.ts"), "utf8");

describe("orders page requires signed-in account", () => {
  it("redirects signed-out users to login", () => {
    expect(ordersPageSrc).toMatch(/auth\(\)/);
    expect(ordersPageSrc).toMatch(/redirect\(/);
    expect(ordersPageSrc).toMatch(/ORDERS_SIGN_IN_PATH/);
  });

  it("does not expose phone OTP order history UI", () => {
    expect(ordersPageSrc).not.toMatch(/OrderHistoryPhoneForm/);
    expect(ordersPageSrc).not.toMatch(/ClearPhoneSessionButton/);
    expect(ordersPageSrc).not.toMatch(/getCustomerSessionFromRequest/);
  });

  it("loads history via getOrdersForSignedInUserAction", () => {
    expect(ordersPageSrc).toMatch(/getOrdersForSignedInUserAction/);
    expect(orderActionsSrc).toMatch(/getOrdersForSignedInUser/);
    expect(orderActionsSrc).not.toMatch(/getOrdersForVerifiedCustomerAction/);
  });
});

describe("order history identity hardening", () => {
  it("order actions gate reorder with signed-in user ownership", () => {
    expect(orderActionsSrc).toMatch(/userCanAccessOrder/);
    expect(orderActionsSrc).toMatch(/SIGN_IN_REQUIRED/);
  });
});
