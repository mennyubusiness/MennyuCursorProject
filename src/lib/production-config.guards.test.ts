import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

const devRouteSources = [
  "src/app/api/dev/simulate-order-status/route.ts",
  "src/app/api/dev/orders/[orderId]/deliverect-payload/route.ts",
  "src/app/dev/orders/[orderId]/page.tsx",
];

describe("dev routes production gating", () => {
  it.each(devRouteSources)("%s is blocked when NODE_ENV is production", (relativePath) => {
    const src = readFileSync(join(root, relativePath), "utf8");
    expect(src).toMatch(/NODE_ENV\s*===\s*["']production["']/);
  });
});

describe("internal job route auth", () => {
  it("requires configured secret before running reconciliation job", () => {
    const src = readFileSync(
      join(root, "src/app/api/internal/jobs/deliverect-reconciliation-fallback/route.ts"),
      "utf8"
    );
    expect(src).toContain("INTERNAL_JOB_SECRET");
    expect(src).toContain("CRON_SECRET");
    expect(src).toMatch(/status:\s*503/);
    expect(src).toMatch(/status:\s*401/);
  });
});
