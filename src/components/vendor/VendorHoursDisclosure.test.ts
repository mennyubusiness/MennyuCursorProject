import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(process.cwd(), "src");

describe("VendorHoursDisclosure", () => {
  const src = readFileSync(join(root, "components/vendor/VendorHoursDisclosure.tsx"), "utf8");

  it("uses an accessible disclosure button with expanded state", () => {
    expect(src).toMatch(/type="button"/);
    expect(src).toMatch(/aria-expanded=\{expanded\}/);
    expect(src).toMatch(/aria-controls=\{panelId\}/);
    expect(src).toMatch(/View full hours/);
    expect(src).toMatch(/Hide hours/);
  });

  it("stops propagation so nested vendor cards do not navigate", () => {
    expect(src).toMatch(/stopPropagation\(\)/);
    expect(src).toMatch(/preventDefault\(\)/);
  });

  it("highlights today's row in the expanded schedule", () => {
    expect(src).toMatch(/row\.isToday/);
    expect(src).toMatch(/\(today\)/);
  });
});

describe("PodVendorCard hours integration", () => {
  const src = readFileSync(join(root, "components/pod/PodVendorCard.tsx"), "utf8");

  it("renders hours outside the card link to avoid nested interactive controls", () => {
    expect(src).toMatch(/VendorHoursDisclosure/);
    expect(src).toMatch(/<\/Link>/);
    expect(src).toMatch(/border-t border-oo-light-stone/);
  });
});

describe("DestinationPodVendorCard hours integration", () => {
  const src = readFileSync(
    join(root, "components/pod/destination/DestinationPodVendorCard.tsx"),
    "utf8"
  );

  it("renders hours outside the card link", () => {
    expect(src).toMatch(/VendorHoursDisclosure/);
    expect(src).toMatch(/<\/Link>/);
  });
});

describe("VendorMenuHero hours integration", () => {
  const src = readFileSync(join(root, "components/vendor-menu/VendorMenuHero.tsx"), "utf8");

  it("shows collapsible vendor hours in the public header", () => {
    expect(src).toMatch(/VendorHoursDisclosure/);
    expect(src).toMatch(/hoursDisplay/);
  });
});
