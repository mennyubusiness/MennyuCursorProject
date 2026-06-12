import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const heroSrc = readFileSync(join(dir, "../components/pod/PodPageHero.tsx"), "utf8");
const navSrc = readFileSync(join(dir, "../components/pod/PodPageStickyNav.tsx"), "utf8");
const pageSrc = readFileSync(join(dir, "../app/pod/[podId]/page.tsx"), "utf8");

describe("PodPageHero banner contrast", () => {
  it("layers image at z-0, overlay at z-10, content at z-20", () => {
    expect(heroSrc).toMatch(/absolute inset-0 z-0/);
    expect(heroSrc).toMatch(/absolute inset-0 z-10 bg-black\/45/);
    expect(heroSrc).toMatch(/relative z-20/);
  });

  it("does not use a visible hero content card wrapper", () => {
    expect(heroSrc).not.toMatch(/rounded-2xl bg-black/);
    expect(heroSrc).not.toMatch(/backdrop-blur/);
    expect(heroSrc).toMatch(/bg-gradient-to-r from-black\/85/);
  });

  it("does not render Save inside the hero", () => {
    expect(heroSrc).not.toMatch(/FavoritePodButton/);
  });

  it("uses white opacity text for readability", () => {
    expect(heroSrc).toMatch(/text-white\/90/);
    expect(heroSrc).toMatch(/text-white\/75/);
  });
});

describe("PodPageStickyNav save placement", () => {
  it("renders Save pod in the sticky nav below the hero", () => {
    expect(navSrc).toMatch(/FavoritePodButton/);
    expect(navSrc).toMatch(/saveLabel="Save pod"/);
    expect(pageSrc).toMatch(/PodPageStickyNav items=\{navItems\} podId=\{pod\.id\} podName=\{pod\.name\}/);
  });
});
