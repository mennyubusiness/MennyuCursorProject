import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { BRAND } from "@/lib/brand-assets";

const publicRoot = join(process.cwd(), "public");

describe("brand assets catalog", () => {
  it("maps every BRAND path to an on-disk file", () => {
    for (const path of Object.values(BRAND)) {
      expect(existsSync(join(publicRoot, path)), `missing ${path}`).toBe(true);
    }
  });

  it("uses the transparent horizontal logo for dark hero/footer surfaces", () => {
    expect(BRAND.horizontalLogo).toBe(
      "/brand/open-order/open-order-horizontal-transparent.png"
    );
  });

  it("uses only approved catalog filenames", () => {
    const approved = new Set([
      "open-order-mark-circle.png",
      "open-order-horizontal-transparent.png",
      "open-order-horizontal-dark.png",
      "open-order-horizontal-dark-silver.png",
      "open-order-horizontal-light.png",
      "open-order-mark-square.png",
      "open-order-seal.png",
    ]);

    for (const path of Object.values(BRAND)) {
      const filename = path.split("/").pop() ?? "";
      expect(approved.has(filename), `unexpected asset ${filename}`).toBe(true);
    }
  });
});
