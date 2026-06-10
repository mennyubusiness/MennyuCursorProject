import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  HOME_HERO_HEADLINE,
  HOME_PRIMARY_CTA_LABEL,
  HOME_SECONDARY_CTA_LABEL,
  homePodOwnerMailtoHref,
} from "@/lib/home-marketing";

const root = join(process.cwd(), "src");

describe("homepage marketing positioning", () => {
  const pageSrc = readFileSync(join(root, "app/page.tsx"), "utf8");
  const heroSrc = readFileSync(join(root, "components/home/HomeHero.tsx"), "utf8");
  const marketingSrc = readFileSync(join(root, "components/home/HomeMarketingSections.tsx"), "utf8");
  const joinSectionSrc = readFileSync(join(root, "components/home/HomeJoinGroupSection.tsx"), "utf8");
  const exploreHeroSrc = readFileSync(join(root, "components/explore/ExploreHero.tsx"), "utf8");
  const podPageSrc = readFileSync(join(root, "app/pod/[podId]/page.tsx"), "utf8");

  it("leads with Open Order branding and pod-owner-first hero copy", () => {
    expect(heroSrc).toMatch(/Open Order/);
    expect(heroSrc).toMatch(/HOME_HERO_HEADLINE/);
    expect(heroSrc).toMatch(/HOME_HERO_SUPPORTING/);
    expect(heroSrc).not.toMatch(/Order everywhere\./);
    expect(HOME_HERO_HEADLINE).toBe("One ordering system for the whole food pod.");
  });

  it("prioritizes pod-owner CTA over explore in the hero", () => {
    expect(heroSrc).toMatch(/HOME_PRIMARY_CTA_LABEL/);
    expect(heroSrc).toMatch(/HOME_SECONDARY_CTA_LABEL/);
    expect(heroSrc).toMatch(/homePodOwnerMailtoHref/);
    expect(heroSrc).toMatch(/href="\/explore"/);
    expect(HOME_PRIMARY_CTA_LABEL).toBe("Bring Open Order to your pod");
    expect(HOME_SECONDARY_CTA_LABEL).toBe("Explore participating pods");
  });

  it("includes problem, solution, pod-owner, vendor, and guest sections", () => {
    expect(pageSrc).toMatch(/HomeMarketingSections/);
    expect(marketingSrc).toMatch(
      /Food pods are built for groups\. The ordering experience is not\./
    );
    expect(marketingSrc).toMatch(/Open Order connects the pod experience\./);
    expect(marketingSrc).toMatch(/Turn your food pod into one connected ordering experience\./);
    expect(marketingSrc).toMatch(/More orders, less disruption\./);
    expect(marketingSrc).toMatch(/Order together\. Eat together\./);
    expect(marketingSrc).toMatch(/Ready to connect your food pod\?/);
  });

  it("repositions explore as a secondary customer path", () => {
    expect(joinSectionSrc).toMatch(/Browse participating pods/);
    expect(joinSectionSrc).toMatch(/No QR code\?/);
    expect(exploreHeroSrc).toMatch(/Most guests scan the QR code on-site/);
    expect(exploreHeroSrc).toMatch(/Secondary path/);
    expect(exploreHeroSrc).not.toMatch(/Order everywhere\./);
  });

  it("preserves QR-first pod entry on pod pages", () => {
    expect(podPageSrc).toMatch(/POD_QR_ENTRY_VALUE/);
    expect(podPageSrc).toMatch(/You&apos;re ordering from/);
  });

  it("uses business contact mailto for pod-owner CTAs", () => {
    expect(homePodOwnerMailtoHref()).toMatch(/^mailto:openorder\.business@gmail\.com/);
    expect(marketingSrc).toMatch(/Contact Open Order/);
  });
});
