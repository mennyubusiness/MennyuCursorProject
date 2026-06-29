import { describe, expect, it } from "vitest";
import { isTerminalOrderStatus, TERMINAL_ORDER_STATUSES } from "./order-terminal-status";

describe("order-terminal-status", () => {
  it("identifies terminal order statuses", () => {
    for (const status of TERMINAL_ORDER_STATUSES) {
      expect(isTerminalOrderStatus(status)).toBe(true);
    }
    expect(isTerminalOrderStatus("accepted")).toBe(false);
    expect(isTerminalOrderStatus("paid")).toBe(false);
  });
});

describe("guest-active-cart-resolution wiring", () => {
  it("cart page uses shared active cart resolver", () => {
    const { readFileSync } = require("node:fs");
    const { join } = require("node:path");
    const cartPage = readFileSync(join(process.cwd(), "src/app/cart/page.tsx"), "utf8");
    const resolver = readFileSync(
      join(process.cwd(), "src/lib/guest-active-cart-resolution.ts"),
      "utf8"
    );
    expect(cartPage).toMatch(/resolveActiveCartForCartPage/);
    expect(resolver).toMatch(/loadActiveGroupCartForCartPage/);
    expect(resolver).toMatch(/loadActiveDisplayCartForSession/);
  });
});
