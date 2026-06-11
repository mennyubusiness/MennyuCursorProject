import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  HOME_HERO_HEADLINE,
  HOME_HERO_SUPPORTING,
  HOME_POD_OWNER_BENEFITS,
  HOME_POD_OWNER_HEADLINE,
  HOME_PRIMARY_CTA_LABEL,
  HOME_QR_FLOW_STEPS,
  HOME_SECONDARY_CTA_LABEL,
  homePodOwnerMailtoHref,
} from "@/lib/home-marketing";
import { BRAND } from "@/lib/brand-assets";

const root = join(process.cwd(), "src");

describe("homepage marketing positioning", () => {
  const pageSrc = readFileSync(join(root, "app/page.tsx"), "utf8");
  const heroSrc = readFileSync(join(root, "components/home/HomeHero.tsx"), "utf8");
  const heroBrandSrc = readFileSync(join(root, "components/home/HomeHeroBrand.tsx"), "utf8");
  const productPreviewSrc = readFileSync(join(root, "components/home/HomeProductPreview.tsx"), "utf8");
  const qrFlowSrc = readFileSync(join(root, "components/home/HomeQrCustomerFlow.tsx"), "utf8");
  const marketingSrc = readFileSync(join(root, "components/home/HomeMarketingSections.tsx"), "utf8");
  const joinSectionSrc = readFileSync(join(root, "components/home/HomeJoinGroupSection.tsx"), "utf8");
  const exploreHeroSrc = readFileSync(join(root, "components/explore/ExploreHero.tsx"), "utf8");
  const podPageSrc = readFileSync(join(root, "app/pod/[podId]/page.tsx"), "utf8");

  it("uses the full horizontal logo in the hero with a mobile compact fallback", () => {
    expect(heroSrc).toMatch(/HomeHeroBrand/);
    expect(heroBrandSrc).toMatch(/BRAND\.horizontalLogo/);
    expect(heroBrandSrc).toMatch(/BRAND\.mark/);
    expect(heroBrandSrc).toMatch(/Open Order/);
    expect(heroBrandSrc).toMatch(/homepage/);
    expect(BRAND.horizontalLogo).toBe("/brand/open-order/open-order-horizontal.svg");
    expect(heroBrandSrc).toMatch(/1100/);
    expect(heroBrandSrc).not.toMatch(/mix-blend-screen/);
    expect(heroBrandSrc).toMatch(/sm:hidden/);
    expect(heroSrc).toMatch(/HomeHeroBrand size=\"homepage\"/);
  });

  it("leads with pod-owner-first hero copy", () => {
    expect(heroSrc).toMatch(/HOME_HERO_HEADLINE/);
    expect(heroSrc).toMatch(/HOME_HERO_SUPPORTING/);
    expect(HOME_HERO_HEADLINE).toBe("One ordering system for the whole food pod.");
    expect(HOME_HERO_SUPPORTING).toMatch(/scan one QR code/);
    expect(HOME_HERO_SUPPORTING).toMatch(/track every pickup/);
    expect(HOME_HERO_SUPPORTING).not.toMatch(/track every kitchen/i);
  });

  it("prioritizes pod-owner CTA over explore in the hero", () => {
    expect(heroSrc).toMatch(/HOME_PRIMARY_CTA_LABEL/);
    expect(heroSrc).toMatch(/HOME_SECONDARY_CTA_LABEL/);
    expect(heroSrc).toMatch(/homePodOwnerMailtoHref/);
    expect(HOME_PRIMARY_CTA_LABEL).toBe("Bring Open Order to your pod");
    expect(HOME_SECONDARY_CTA_LABEL).toBe("Explore participating pods");
  });

  it("shows QR-first flow and a product preview mockup", () => {
    expect(heroSrc).toMatch(/HomeQrCustomerFlow/);
    expect(heroSrc).toMatch(/HomeProductPreview/);
    expect(qrFlowSrc).toMatch(/HOME_QR_FLOW_STEPS/);
    expect(HOME_QR_FLOW_STEPS[0]).toBe("Scan QR");
    expect(HOME_QR_FLOW_STEPS).toContain("Track pickup");
    expect(productPreviewSrc).toMatch(/Willamette Garage/);
    expect(productPreviewSrc).toMatch(/4 items from 2 vendors/);
    expect(productPreviewSrc).toMatch(/One checkout across the pod/);
  });

  it("makes the pod-owner section visually dominant with updated copy", () => {
    expect(marketingSrc).toMatch(/HOME_POD_OWNER_HEADLINE/);
    expect(HOME_POD_OWNER_HEADLINE).toBe("Make your food pod feel like one connected place.");
    expect(marketingSrc).toMatch(/HOME_POD_OWNER_BENEFITS/);
    expect(HOME_POD_OWNER_BENEFITS).toContain("Vendor-friendly operations");
    expect(marketingSrc).not.toMatch(/track every kitchen/i);
    expect(marketingSrc).not.toMatch(/every kitchen in the pod/i);
  });

  it("keeps vendor and guest sections secondary", () => {
    expect(marketingSrc).toMatch(/More orders, less disruption\./);
    expect(marketingSrc).toMatch(/Order together\. Eat together\./);
  });

  it("hides customer dashboard widgets for signed-out visitors", () => {
    expect(pageSrc).toMatch(/isSignedIn/);
    expect(pageSrc).toMatch(/isSignedIn \?/);
    expect(joinSectionSrc).toMatch(/Signed in/);
    expect(joinSectionSrc).not.toMatch(/No QR code\?/);
  });

  it("repositions explore as a secondary customer path", () => {
    expect(exploreHeroSrc).toMatch(/Most guests scan the QR code on-site/);
    expect(exploreHeroSrc).toMatch(/Secondary path/);
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
