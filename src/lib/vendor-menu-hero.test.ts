import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const heroSrc = readFileSync(
  join(process.cwd(), "src/components/vendor-menu/VendorMenuHero.tsx"),
  "utf8"
);

describe("VendorMenuHero", () => {
  it("renders a subtle back link to the parent pod page", () => {
    expect(heroSrc).toMatch(/Back to \$\{trimmedPodName\}/);
    expect(heroSrc).toMatch(/Back to pod/);
    expect(heroSrc).toMatch(/href=\{podHref\}/);
    expect(heroSrc).toMatch(/const podHref = `\/pod\/\$\{podId\}`/);
    expect(heroSrc).toMatch(/←/);
    expect(heroSrc).toMatch(/hover:text-brand/);
  });

  it("does not render the old breadcrumb trail", () => {
    expect(heroSrc).not.toMatch(/aria-label="Breadcrumb"/);
    expect(heroSrc).not.toMatch(/\/\s*\n?\s*<\/li>/);
    expect(heroSrc).not.toMatch(/\{vendorName\}<\/li>/);
  });

  it("does not render redundant pickup or cart metadata", () => {
    expect(heroSrc).not.toMatch(/Pickup at pod/);
    expect(heroSrc).not.toMatch(/Shared multi-vendor cart/);
  });

  it("keeps vendor status and cuisine category in the meta row", () => {
    expect(heroSrc).toMatch(/VendorStatusBadge/);
    expect(heroSrc).toMatch(/cuisineCategory\?\.trim\(\)/);
  });

  it("preserves vendor identity content", () => {
    expect(heroSrc).toMatch(/VendorLogo/);
    expect(heroSrc).toMatch(/\{vendorName\}/);
    expect(heroSrc).toMatch(/trimmedPodName \|\| "pod"/);
    expect(heroSrc).toMatch(/vendorDescription\?\.trim\(\)/);
  });
});
