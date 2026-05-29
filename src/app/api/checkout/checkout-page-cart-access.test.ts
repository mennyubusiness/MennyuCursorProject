import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));

const checkoutPageSrc = readFileSync(join(dir, "..", "..", "checkout", "page.tsx"), "utf8");
const checkoutApiSrc = readFileSync(join(dir, "route.ts"), "utf8");

describe("checkout SSR and API cart access alignment", () => {
  it("checkout page rejects solo carts that do not belong to the current session", () => {
    expect(checkoutPageSrc).toMatch(/cart\.sessionId\s*!==\s*\(sessionId/);
  });

  it("checkout page restricts group checkout to host user", () => {
    expect(checkoutPageSrc).toMatch(/groupSession\.hostUserId/);
  });

  it("checkout API uses assertCartSessionAccess before createOrderFromCart", () => {
    expect(checkoutApiSrc).toMatch(/assertCartSessionAccess/);
    expect(checkoutApiSrc).toMatch(/mennyuSessionId:\s*sessionId/);
  });
});
