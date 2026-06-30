import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));

describe("vendor menu builder page", () => {
  it("gates deliverect vendors and loads builder data for open_order vendors", () => {
    const page = readFileSync(join(dir, "page.tsx"), "utf8");
    expect(page).toMatch(/gateOpenOrderMenuBuilderRoutes/);
    expect(page).toMatch(/loadVendorMenuBuilderPageData/);
    expect(page).toMatch(/VendorMenuBuilderView/);
  });
});
