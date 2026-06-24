import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(process.cwd(), "src");
const libDir = dirname(fileURLToPath(import.meta.url));
const componentsPod = join(root, "components/pod");

function readComponent(relativePath: string): string {
  return readFileSync(join(componentsPod, relativePath), "utf8");
}

function readLib(relativePath: string): string {
  return readFileSync(join(libDir, relativePath), "utf8");
}

describe("public pod page QR entry", () => {
  it("uses shared PodQrEntryBanner on both templates", () => {
    const destination = readComponent("destination/DestinationPodPageView.tsx");
    const standard = readComponent("StandardPodPageView.tsx");
    const banner = readComponent("PodQrEntryBanner.tsx");

    expect(destination).toContain("PodQrEntryBanner");
    expect(standard).toContain("PodQrEntryBanner");
    expect(banner).toContain("one cart, one checkout, one pickup");
  });

  it("skips destination marquee and compacts hero on QR entry", () => {
    const hero = readComponent("destination/DestinationPodHero.tsx");
    const page = readComponent("destination/DestinationPodPageView.tsx");

    expect(hero).toContain("isQrEntry");
    expect(hero).toMatch(/!isQrEntry/);
    expect(page).toContain("isQrEntry={isQrEntry}");
  });

  it("places announcement after vendors on QR entry to keep ordering first", () => {
    const destination = readComponent("destination/DestinationPodPageView.tsx");
    const standard = readComponent("StandardPodPageView.tsx");

    expect(destination).toMatch(/!isQrEntry \? announcementBlock : null[\s\S]*DestinationPodVendorSection/);
    expect(destination).toMatch(/DestinationPodVendorSection[\s\S]*isQrEntry \? announcementBlock : null/);
    expect(standard).toMatch(/!isQrEntry \? announcementBlock : null[\s\S]*PodPageVendorSection/);
    expect(standard).toMatch(/PodPageVendorSection[\s\S]*isQrEntry \? announcementBlock : null/);
  });

  it("prioritizes browse vendors in standard hero on QR entry", () => {
    const actions = readComponent("PodPageHeroActions.tsx");
    expect(actions).toContain("isQrEntry");
    expect(actions).toContain('href="#pod-vendors"');
    expect(actions).toContain("Browse vendors");
    expect(actions).toMatch(/if \(isQrEntry\)[\s\S]*browseVendorsCta/);
  });
});

describe("public pod announcement banner", () => {
  it("wraps long plain text and supports compact QR spacing", () => {
    const banner = readComponent("PodAnnouncementBanner.tsx");
    expect(banner).toContain("[overflow-wrap:anywhere]");
    expect(banner).toContain("break-words");
    expect(banner).toContain("compact");
    expect(banner).not.toMatch(/dangerouslySetInnerHTML/);
  });

  it("only renders when active announcement text is provided upstream", () => {
    const data = readLib("pod-customer-page-data.ts");
    const announcement = readLib("pod-announcement.ts");
    expect(data).toContain("getPublicPodAnnouncementText");
    expect(announcement).toContain("shouldShowPodAnnouncement");
  });
});

describe("public pod vendor cards", () => {
  it("uses canonical slug vendor menu links", () => {
    const standard = readComponent("PodVendorCard.tsx");
    const destination = readComponent("destination/DestinationPodVendorCard.tsx");
    expect(standard).toContain("buildVendorMenuCustomerPath");
    expect(destination).toContain("buildVendorMenuCustomerPath");
    expect(standard).not.toMatch(/\/pod\/\$\{/);
    expect(destination).not.toMatch(/\/pod\/\$\{/);
  });

  it("does not imply unavailable featured vendors are orderable", () => {
    const standard = readComponent("PodVendorCard.tsx");
    const destination = readComponent("destination/DestinationPodVendorCard.tsx");
    expect(standard).toMatch(/isFeatured && !availability\.unavailable/);
    expect(destination).toMatch(/isFeatured && !unavailable/);
    expect(standard).toMatch(/availability\.unavailable && "opacity-60"/);
    expect(destination).toContain('unavailable ? "View menu" : "Order now"');
  });

  it("uses customer-facing status labels without internal enums in UI", () => {
    const standard = readComponent("PodVendorCard.tsx");
    const destination = readComponent("destination/DestinationPodVendorCard.tsx");
    const data = readLib("pod-customer-page-data.ts");
    expect(data).toContain('"Closed"');
    expect(data).toContain('"Not accepting orders"');
    expect(standard).not.toMatch(/mennyu_paused|routingStatus|fulfillmentStatus/);
    expect(destination).not.toMatch(/mennyu_paused|routingStatus|fulfillmentStatus/);
  });

  it("uses brand primary CTA on standard vendor cards", () => {
    const standard = readComponent("PodVendorCard.tsx");
    expect(standard).toContain("bg-brand");
    expect(standard).not.toMatch(/bg-oo-charcoal px-4 py-2\.5/);
  });
});

describe("public pod group ordering", () => {
  it("shows secondary group-order hint without duplicating modal copy", () => {
    const hint = readComponent("PodPageGroupOrderHint.tsx");
    const vendorSection = readComponent("destination/DestinationPodVendorSection.tsx");
    expect(hint).toContain("Ordering with a group?");
    expect(hint).toContain("Start or join a shared order");
    expect(vendorSection).toContain("PodPageGroupOrderHint");
  });

  it("skips destination first-visit group modal on QR entry", () => {
    const gate = readLib("destination-pod-group-prompt.ts");
    expect(gate).toMatch(/if \(input\.isQrEntry\) return false/);
  });
});

describe("public pod vendor section copy", () => {
  it("communicates multi-vendor ordering and pickup", () => {
    const destination = readComponent("destination/DestinationPodVendorSection.tsx");
    const standard = readComponent("PodPageVendorSection.tsx");
    for (const src of [destination, standard]) {
      expect(src).toContain("Order from multiple vendors");
      expect(src).toContain("one cart");
      expect(src).toContain("pick up at");
    }
  });

  it("guides customers when no vendors are listed", () => {
    const destination = readComponent("destination/DestinationPodVendorSection.tsx");
    expect(destination).toContain("No vendors taking orders yet");
    expect(destination).toContain("Explore pods");
  });
});
