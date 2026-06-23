import { afterEach, describe, expect, it, vi } from "vitest";

describe("isAddToCartTraceEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is off in production even when env flag is true", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEBUG_ADD_TO_CART_TRACE", "true");
    const { isAddToCartTraceEnabled } = await import("./debug-add-to-cart-trace");
    expect(isAddToCartTraceEnabled()).toBe(false);
  });

  it("is off in development when env flag is unset or false", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEBUG_ADD_TO_CART_TRACE", "");
    const { isAddToCartTraceEnabled } = await import("./debug-add-to-cart-trace");
    expect(isAddToCartTraceEnabled()).toBe(false);

    vi.stubEnv("DEBUG_ADD_TO_CART_TRACE", "false");
    const mod = await import("./debug-add-to-cart-trace");
    expect(mod.isAddToCartTraceEnabled()).toBe(false);
  });

  it("is on in development or test only when explicitly enabled", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEBUG_ADD_TO_CART_TRACE", "true");
    const { isAddToCartTraceEnabled } = await import("./debug-add-to-cart-trace");
    expect(isAddToCartTraceEnabled()).toBe(true);

    vi.stubEnv("NODE_ENV", "test");
    const mod = await import("./debug-add-to-cart-trace");
    expect(mod.isAddToCartTraceEnabled()).toBe(true);
  });
});
