import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { FULL_BLEED_VIEWPORT_CLASS } from "./full-bleed-layout";

const dir = dirname(fileURLToPath(import.meta.url));
const layoutSrc = readFileSync(join(dir, "../app/layout.tsx"), "utf8");
const podHeroSrc = readFileSync(join(dir, "../components/pod/PodPageHero.tsx"), "utf8");
const destinationHeroSrc = readFileSync(
  join(dir, "../components/pod/destination/DestinationPodHero.tsx"),
  "utf8"
);

describe("FULL_BLEED_VIEWPORT_CLASS", () => {
  it("breaks out to viewport width", () => {
    expect(FULL_BLEED_VIEWPORT_CLASS).toMatch(/w-screen/);
    expect(FULL_BLEED_VIEWPORT_CLASS).toMatch(/-translate-x-1\/2/);
    expect(FULL_BLEED_VIEWPORT_CLASS).toMatch(/overflow-x-clip/);
  });
});

describe("Root layout full-bleed routing", () => {
  it("treats canonical customer pod slug pages as full bleed", () => {
    expect(layoutSrc).toMatch(/isCustomerPodSlugPath\(pathname\)/);
    expect(layoutSrc).toMatch(/isCustomerPodSurface/);
    expect(layoutSrc).toMatch(/isFullBleed \? "" : "px-4/);
  });
});

describe("Pod hero full bleed", () => {
  it("applies viewport bleed wrapper on standard hero", () => {
    expect(podHeroSrc).toMatch(/FULL_BLEED_VIEWPORT_CLASS/);
    expect(podHeroSrc).toMatch(/object-cover/);
    expect(podHeroSrc).toMatch(/fill/);
  });

  it("applies viewport bleed wrapper on destination hero", () => {
    expect(destinationHeroSrc).toMatch(/FULL_BLEED_VIEWPORT_CLASS/);
    expect(destinationHeroSrc).toMatch(/items-center justify-center/);
    expect(destinationHeroSrc).toMatch(/object-cover/);
  });
});
