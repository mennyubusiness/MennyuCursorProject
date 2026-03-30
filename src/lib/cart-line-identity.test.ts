import { describe, expect, it } from "vitest";
import { normalizedConfigurationKey } from "./cart-line-identity";

describe("cart-line-identity", () => {
  it("treats null and empty selections the same for plain adds", () => {
    const a = normalizedConfigurationKey(null, null);
    const b = normalizedConfigurationKey(null, []);
    expect(a).toBe(b);
  });

  it("differs when modifier selections differ", () => {
    const a = normalizedConfigurationKey(null, [{ modifierOptionId: "opt1", quantity: 1 }]);
    const b = normalizedConfigurationKey(null, [{ modifierOptionId: "opt2", quantity: 1 }]);
    expect(a).not.toBe(b);
  });

  it("is order-insensitive for option ids", () => {
    const a = normalizedConfigurationKey(null, [
      { modifierOptionId: "b", quantity: 1 },
      { modifierOptionId: "a", quantity: 2 },
    ]);
    const b = normalizedConfigurationKey(null, [
      { modifierOptionId: "a", quantity: 2 },
      { modifierOptionId: "b", quantity: 1 },
    ]);
    expect(a).toBe(b);
  });
});
