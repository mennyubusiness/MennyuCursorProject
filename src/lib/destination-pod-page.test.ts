import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const heroSrc = readFileSync(
  join(dir, "../components/pod/destination/DestinationPodHero.tsx"),
  "utf8"
);
const marqueeSrc = readFileSync(
  join(dir, "../components/pod/destination/DestinationPodMarquee.tsx"),
  "utf8"
);
const pageViewSrc = readFileSync(
  join(dir, "../components/pod/destination/DestinationPodPageView.tsx"),
  "utf8"
);
const vendorSectionSrc = readFileSync(
  join(dir, "../components/pod/destination/DestinationPodVendorSection.tsx"),
  "utf8"
);

describe("DestinationPodHero", () => {
  it("centers pod name over a muted banner masthead", () => {
    expect(heroSrc).toMatch(/items-center justify-center/);
    expect(heroSrc).toMatch(/text-center/);
    expect(heroSrc).toMatch(/text-oo-warm-white/);
    expect(heroSrc).toMatch(/bg-black\/55/);
  });

  it("does not render hero utility buttons, address, or badges", () => {
    expect(heroSrc).not.toMatch(/DestinationPodHeroActions/);
    expect(heroSrc).not.toMatch(/Start order/);
    expect(heroSrc).not.toMatch(/Get directions/);
    expect(heroSrc).not.toMatch(/One cart/);
    expect(heroSrc).not.toMatch(/vendor/);
    expect(heroSrc).not.toMatch(/orderingStatus/);
    expect(heroSrc).not.toMatch(/address/);
  });

  it("only shows an explicit tagline when provided", () => {
    expect(heroSrc).toMatch(/tagline\?\.trim\(\)/);
    expect(heroSrc).not.toMatch(/description/);
  });
});

describe("DestinationPodMarquee", () => {
  it("uses light text on a dark background", () => {
    expect(marqueeSrc).toMatch(/text-oo-warm-white/);
    expect(marqueeSrc).toMatch(/bg-oo-charcoal/);
    expect(marqueeSrc).toMatch(/text-brand/);
  });

  it("animates horizontally without wrapping", () => {
    expect(marqueeSrc).toMatch(/overflow-hidden/);
    expect(marqueeSrc).toMatch(/whitespace-nowrap/);
    expect(marqueeSrc).toMatch(/min-w-max/);
    expect(marqueeSrc).toMatch(/animate-destination-pod-marquee/);
    expect(marqueeSrc).not.toMatch(/flex-wrap/);
    expect(marqueeSrc).toMatch(/motion-reduce:animate-none/);
  });
});

describe("DestinationPodPageView", () => {
  it("omits the About section for now", () => {
    expect(pageViewSrc).not.toMatch(/DestinationPodAboutSection/);
    expect(pageViewSrc).toMatch(/hasAboutSection: false/);
  });
});

describe("DestinationPodVendorSection", () => {
  it("uses the simplified vendor heading", () => {
    expect(vendorSectionSrc).toMatch(/Check out our vendors/);
    expect(vendorSectionSrc).not.toMatch(/Order from vendors at/);
  });
});
