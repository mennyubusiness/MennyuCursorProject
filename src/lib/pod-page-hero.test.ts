import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const heroSrc = readFileSync(join(dir, "../components/pod/PodPageHero.tsx"), "utf8");

describe("PodPageHero banner contrast", () => {
  it("layers image at z-0, overlay at z-10, content at z-20", () => {
    expect(heroSrc).toMatch(/absolute inset-0 z-0/);
    expect(heroSrc).toMatch(/absolute inset-0 z-10 bg-black\/60/);
    expect(heroSrc).toMatch(/relative z-20/);
    expect(heroSrc).toMatch(/pointer-events-none absolute inset-0 z-10/);
  });

  it("uses black opacity overlays that render reliably in Tailwind", () => {
    expect(heroSrc).toMatch(/bg-gradient-to-r from-black\/80 via-black\/55 to-black\/35/);
    expect(heroSrc).not.toMatch(/bg-oo-charcoal\/60/);
  });

  it("uses warm-white hero text and translucent secondary badges", () => {
    expect(heroSrc).toMatch(/text-oo-warm-white/);
    expect(heroSrc).toMatch(/text-oo-cream\/85/);
    expect(heroSrc).toMatch(/heroMetaBadge/);
    expect(heroSrc).toMatch(/heroSecondaryCta/);
  });
});
