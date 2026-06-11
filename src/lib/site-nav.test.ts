import { describe, expect, it } from "vitest";

import { isSiteNavLinkActive, SITE_NAV_LINKS } from "@/lib/site-nav";

describe("site nav links", () => {
  it("includes marketing and customer discovery routes", () => {
    const hrefs = SITE_NAV_LINKS.map((link) => link.href);
    expect(hrefs).toEqual(["/", "/about", "/for-pods", "/faq", "/explore"]);
  });

  it("marks home active only on the root path", () => {
    expect(isSiteNavLinkActive("/", "/")).toBe(true);
    expect(isSiteNavLinkActive("/about", "/")).toBe(false);
  });

  it("marks nested marketing routes active", () => {
    expect(isSiteNavLinkActive("/for-pods", "/for-pods")).toBe(true);
    expect(isSiteNavLinkActive("/faq", "/faq")).toBe(true);
  });
});
