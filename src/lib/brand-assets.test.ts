import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { BRAND } from "@/lib/brand-assets";

const publicRoot = join(process.cwd(), "public");

describe("brand assets catalog", () => {
  it("maps every BRAND path to an on-disk file", () => {
    for (const path of Object.values(BRAND)) {
      expect(existsSync(join(publicRoot, path)), `missing ${path}`).toBe(true);
    }
  });

  it("uses the cropped SVG horizontal logo for dark hero/footer surfaces", () => {
    expect(BRAND.horizontalLogo).toBe("/brand/open-order/open-order-horizontal.svg");
    const svg = join(publicRoot, BRAND.horizontalLogo);
    const contents = readFileSync(svg, "utf8");
    expect(contents).toMatch(/viewBox="352 609 2296 310"/);
  });

  it("uses a transparent mark SVG without baked canvas backgrounds", () => {
    expect(BRAND.mark).toBe("/brand/open-order/open-order-mark.svg");
    const svg = readFileSync(join(publicRoot, BRAND.mark), "utf8");
    expect(svg).not.toMatch(/fill="#ffffff"/);
    expect(svg).not.toMatch(/width="5184" fill="#e7e0d6"/);
  });

  it("uses a transparent raster mark for favicon surfaces", async () => {
    expect(BRAND.markRaster).toBe("/brand/open-order/open-order-mark.png");
    const { data } = await sharp(join(publicRoot, BRAND.markRaster))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const cornerAlpha = [0, 0, 1023, 1023].map((offset) => data[offset * 4 + 3]);
    expect(cornerAlpha.every((alpha) => alpha === 0)).toBe(true);
  });

  it("uses only approved catalog filenames", () => {
    const approved = new Set([
      "open-order-mark.svg",
      "open-order-mark.png",
      "open-order-mark-circle.png",
      "open-order-horizontal.svg",
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
