import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const heroSrc = readFileSync(join(dir, "../components/pod/PodPageHero.tsx"), "utf8");

describe("PodPageHero banner contrast", () => {
  it("uses layered dark overlays for readable text on any banner", () => {
    expect(heroSrc).toMatch(/bg-oo-charcoal\/60/);
    expect(heroSrc).toMatch(/bg-gradient-to-r from-oo-charcoal\/85 via-oo-charcoal\/55 to-oo-charcoal\/25/);
    expect(heroSrc).toMatch(/bg-gradient-to-t from-oo-charcoal\/75/);
  });

  it("uses warm-white hero text and translucent secondary badges", () => {
    expect(heroSrc).toMatch(/text-oo-warm-white/);
    expect(heroSrc).toMatch(/text-oo-cream\/85/);
    expect(heroSrc).toMatch(/heroMetaBadge/);
    expect(heroSrc).toMatch(/heroSecondaryCta/);
  });
});
