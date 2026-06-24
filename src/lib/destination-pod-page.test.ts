import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { buildDestinationPodNavItems } from "./pod-page-nav";

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
const aboutSectionSrc = readFileSync(
  join(dir, "../components/pod/destination/DestinationPodAboutSection.tsx"),
  "utf8"
);
const groupPromptSrc = readFileSync(
  join(dir, "../components/pod/destination/DestinationPodGroupOrderPrompt.tsx"),
  "utf8"
);
const groupPromptGateSrc = readFileSync(
  join(dir, "../components/pod/destination/DestinationPodGroupOrderPromptGate.tsx"),
  "utf8"
);
const stickyNavSrc = readFileSync(
  join(dir, "../components/pod/destination/DestinationPodStickyNav.tsx"),
  "utf8"
);
const vendorSectionSrc = readFileSync(
  join(dir, "../components/pod/destination/DestinationPodVendorSection.tsx"),
  "utf8"
);
const vendorCardSrc = readFileSync(
  join(dir, "../components/pod/destination/DestinationPodVendorCard.tsx"),
  "utf8"
);
const standardPageSrc = readFileSync(
  join(dir, "../components/pod/StandardPodPageView.tsx"),
  "utf8"
);
const standardVendorCardSrc = readFileSync(join(dir, "../components/pod/PodVendorCard.tsx"), "utf8");
const navSrc = readFileSync(join(dir, "../lib/pod-page-nav.ts"), "utf8");

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
    expect(heroSrc).not.toMatch(/orderingStatus/);
    expect(heroSrc).not.toMatch(/address/);
  });

  it("renders marquee outside the hero header for full bleed", () => {
    expect(heroSrc).toMatch(/<\/header>/);
    expect(heroSrc).toMatch(/DestinationPodMarquee items=\{marqueeItems\}/);
    expect(heroSrc).toMatch(/\{marqueeItems\.length > 0 && !isQrEntry/);
  });
});

describe("DestinationPodMarquee", () => {
  it("uses light text on a dark background", () => {
    expect(marqueeSrc).toMatch(/text-oo-warm-white/);
    expect(marqueeSrc).toMatch(/bg-oo-charcoal/);
    expect(marqueeSrc).toMatch(/text-brand/);
  });

  it("spans full viewport width with overflow clipped on the bleed wrapper", () => {
    expect(marqueeSrc).toMatch(/w-screen/);
    expect(marqueeSrc).toMatch(/overflow-x-clip/);
    expect(marqueeSrc).toMatch(/-translate-x-1\/2/);
  });

  it("loops seamlessly with two identical rows and -50% animation track", () => {
    expect(marqueeSrc).toMatch(/overflow-hidden/);
    expect(marqueeSrc).toMatch(/whitespace-nowrap/);
    expect(marqueeSrc).toMatch(/min-w-max/);
    expect(marqueeSrc).toMatch(/shrink-0/);
    expect(marqueeSrc).toMatch(/animate-destination-pod-marquee sm:animate-destination-pod-marquee-desktop/);
    expect(marqueeSrc).toMatch(/MarqueeRow items=\{items\}/);
    expect(marqueeSrc).toMatch(/MarqueeRow items=\{items\} ariaHidden/);
    expect(marqueeSrc).not.toMatch(/flex-wrap/);
    expect(marqueeSrc).toMatch(/motion-reduce:hidden/);
    expect(marqueeSrc).toMatch(/motion-reduce:block/);
  });
});

describe("DestinationPodPageView layout", () => {
  it("renders consolidated About section and omits standalone group-order block", () => {
    expect(pageViewSrc).toMatch(/DestinationPodAboutSection/);
    expect(pageViewSrc).not.toMatch(/DestinationPodGroupOrderSection/);
    expect(pageViewSrc).not.toMatch(/DestinationPodVisitSection/);
    expect(pageViewSrc).not.toMatch(/DestinationPodGroupOrderNavActions/);
  });

  it("does not render main-page group-order buttons in the sticky nav", () => {
    expect(pageViewSrc).not.toMatch(/trailingActions=/);
    expect(pageViewSrc).not.toMatch(/PodPageJoinWithCodeButton/);
    expect(pageViewSrc).not.toMatch(/PodPageStartGroupOrderButton/);
    expect(pageViewSrc).not.toMatch(/Start group order/);
    expect(pageViewSrc).not.toMatch(/Join with code/);
  });

  it("mounts QR banner and defers announcement on direct QR entry", () => {
    expect(pageViewSrc).toMatch(/PodQrEntryBanner/);
    expect(pageViewSrc).toMatch(/DestinationPodGroupOrderPromptGate/);
    expect(groupPromptGateSrc).toMatch(/shouldOfferDestinationGroupOrderPrompt/);
    expect(groupPromptGateSrc).toMatch(/getPodPageGroupOrderCtaState/);
  });

  it("does not change the standard pod page layout", () => {
    expect(standardPageSrc).not.toMatch(/DestinationPodGroupOrderPromptGate/);
    expect(standardPageSrc).not.toMatch(/DestinationPodAboutSection/);
    expect(standardPageSrc).not.toMatch(/DestinationPodStickyNav/);
    expect(standardPageSrc).toMatch(/PodPageStickyNav/);
    expect(standardPageSrc).toMatch(/PodPageIdentitySection/);
    expect(standardPageSrc).toMatch(/PodPageStickyCta/);
    expect(standardPageSrc).toMatch(/PodPageHero/);
  });

  it("omits mobile bottom sticky CTA on Destination variant", () => {
    expect(pageViewSrc).not.toMatch(/PodPageStickyCta/);
    expect(pageViewSrc).not.toMatch(/pb-20/);
  });

  it("builds marquee from vendor names only", () => {
    expect(pageViewSrc).toMatch(/vendorNames: vendorRows\.map/);
  });

  it("passes amenities to About section once without a separate grid", () => {
    expect(pageViewSrc).toMatch(/amenities=\{amenities\}/);
    expect(pageViewSrc).toMatch(/customAmenities=\{customAmenities\}/);
    expect(pageViewSrc).not.toMatch(/DestinationPodAmenityGrid/);
    expect(pageViewSrc).not.toMatch(/Known for/);
  });
});

describe("DestinationPodStickyNav", () => {
  it("uses a compact single-row layout with aligned nav links and Save pod", () => {
    expect(pageViewSrc).toMatch(/DestinationPodStickyNav/);
    expect(pageViewSrc).not.toMatch(/PodPageStickyNav/);
    expect(stickyNavSrc).toMatch(/flex items-center justify-between/);
    expect(stickyNavSrc).toMatch(/items-center gap-2 overflow-x-auto sm:gap-4/);
    expect(stickyNavSrc).toMatch(/self-center/);
    expect(stickyNavSrc).toMatch(/py-3/);
    expect(stickyNavSrc).not.toMatch(/flex-col/);
    expect(stickyNavSrc).not.toMatch(/flex-wrap/);
  });

  it("styles Save pod as a compact secondary action aligned to nav height", () => {
    expect(stickyNavSrc).toMatch(/saveLabel="Save pod"/);
    expect(stickyNavSrc).toMatch(/!h-10/);
    expect(stickyNavSrc).toMatch(/inline-flex h-10 shrink-0 items-center/);
    expect(stickyNavSrc).toMatch(/!text-xs/);
    expect(stickyNavSrc).toMatch(/!bg-oo-warm-white/);
  });
});

describe("DestinationPodGroupOrderPrompt", () => {
  it("shows the first-visit modal copy and actions after client hydration", () => {
    expect(groupPromptSrc).toMatch(/Ordering with friends\?/);
    expect(groupPromptSrc).toMatch(
      /Start a group order so everyone can add from different vendors, or join an existing order with a code\./
    );
    expect(groupPromptSrc).toMatch(/Start group order/);
    expect(groupPromptSrc).toMatch(/Join with code/);
    expect(groupPromptSrc).toMatch(/Continue browsing/);
    expect(groupPromptSrc).toMatch(/shouldOpenDestinationGroupOrderPrompt/);
    expect(groupPromptSrc).toMatch(/setHydrated\(true\)/);
  });

  it("reuses existing start and join flows and remembers dismissal per pod", () => {
    expect(groupPromptSrc).toMatch(/StartGroupOrderButton/);
    expect(groupPromptSrc).toMatch(/JoinGroupOrderByCodeModal/);
    expect(groupPromptSrc).toMatch(/markDestinationGroupPromptDismissed\(podId\)/);
    expect(groupPromptSrc).toMatch(/isDestinationGroupPromptDismissed\(podId\)/);
    expect(groupPromptSrc).toMatch(/Z_DESTINATION_GROUP_PROMPT/);
  });

  it("dismisses the prompt when continuing, closing, or starting a group order", () => {
    expect(groupPromptSrc).toMatch(/onClose=\{dismissPrompt\}/);
    expect(groupPromptSrc).toMatch(/onClick=\{dismissPrompt\}/);
    expect(groupPromptSrc).toMatch(/onStarted=\{handleStarted\}/);
  });
});

describe("DestinationPodAboutSection", () => {
  it("uses About heading with one simple amenities block and contact info", () => {
    expect(aboutSectionSrc).toMatch(/About \{podName\}/);
    expect(aboutSectionSrc).not.toMatch(/Visit \{podName\}/);
    expect(aboutSectionSrc).toMatch(/Amenities/);
    expect(aboutSectionSrc).toMatch(/buildDestinationPodAmenityLabels/);
    expect(aboutSectionSrc).toMatch(/Pickup instructions/);
    expect(aboutSectionSrc).toMatch(/Get directions/);
    expect(aboutSectionSrc).toMatch(/id="pod-about"/);
    expect(aboutSectionSrc).not.toMatch(/Known for/);
    expect(aboutSectionSrc).not.toMatch(/DestinationPodAmenityGrid/);
  });

  it("renders amenities only when labels exist and does not duplicate sections", () => {
    expect(aboutSectionSrc).toMatch(/amenityLabels\.length > 0 &&/);
    expect(aboutSectionSrc.match(/<h3[^>]*>\s*\n?\s*Amenities\s*\n?\s*<\/h3>/g)?.length).toBe(1);
    expect(aboutSectionSrc).toMatch(/customAmenities/);
  });
});

describe("buildDestinationPodNavItems", () => {
  it("links Vendors and About only", () => {
    expect(buildDestinationPodNavItems({ hasAboutSection: false })).toEqual([
      { id: "pod-vendors", label: "Vendors" },
    ]);
    expect(buildDestinationPodNavItems({ hasAboutSection: true })).toEqual([
      { id: "pod-vendors", label: "Vendors" },
      { id: "pod-about", label: "About" },
    ]);
    expect(navSrc).not.toMatch(/pod-group-order/);
    expect(navSrc).not.toMatch(/pod-visit/);
  });
});

describe("DestinationPodVendorSection", () => {
  it("uses conversion-focused vendor heading copy", () => {
    expect(vendorSectionSrc).toMatch(/Order from multiple vendors/);
    expect(vendorSectionSrc).toContain("PodPageGroupOrderHint");
    expect(vendorSectionSrc).not.toMatch(/Check out our vendors/);
  });
});

describe("DestinationPodVendorCard", () => {
  it("shows customer-facing status and order CTA", () => {
    expect(vendorCardSrc).toMatch(/href=\{href\}/);
    expect(vendorCardSrc).toContain("Order now");
    expect(vendorCardSrc).toContain("View menu");
    expect(vendorCardSrc).toContain("Open");
    expect(vendorCardSrc).toContain("bg-brand");
  });

  it("mutes unavailable featured vendors", () => {
    expect(vendorCardSrc).toMatch(/isFeatured && !unavailable/);
    expect(vendorCardSrc).toMatch(/unavailable && "opacity-60"/);
  });

  it("does not change the standard pod vendor card order CTA", () => {
    expect(standardVendorCardSrc).toMatch(/Order now/);
    expect(standardVendorCardSrc).toMatch(/Open/);
  });
});
