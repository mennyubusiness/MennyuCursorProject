import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const heroSrc = readFileSync(join(dir, "../components/pod/PodPageHero.tsx"), "utf8");

describe("PodPageHero banner contrast", () => {
  it("layers image at z-0, overlay at z-10, content at z-20", () => {
    expect(heroSrc).toMatch(/absolute inset-0 z-0/);
    expect(heroSrc).toMatch(/absolute inset-0 z-10 bg-black\/45/);
    expect(heroSrc).toMatch(/relative z-20/);
    expect(heroSrc).toMatch(/pointer-events-none absolute inset-0 z-10/);
  });

  it("uses balanced black overlays and white opacity text for readability", () => {
    expect(heroSrc).toMatch(/bg-gradient-to-r from-black\/80 via-black\/55 to-black\/20/);
    expect(heroSrc).toMatch(/text-white\/90/);
    expect(heroSrc).toMatch(/text-white\/75/);
    expect(heroSrc).not.toMatch(/bg-black\/60/);
  });

  it("places Save beside title on desktop and in action row on mobile", () => {
    expect(heroSrc).toMatch(/heroSaveButton/);
    expect(heroSrc).toMatch(/hidden sm:inline-flex/);
    expect(heroSrc).toMatch(/sm:hidden/);
  });

  it("uses opaque meta badges and warm-white secondary CTA", () => {
    expect(heroSrc).toMatch(/heroMetaBadge/);
    expect(heroSrc).toMatch(/bg-white\/90/);
    expect(heroSrc).toMatch(/heroSecondaryCta/);
  });
});
