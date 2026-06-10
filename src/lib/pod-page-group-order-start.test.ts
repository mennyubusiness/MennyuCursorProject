import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("pod page in-place group order start", () => {
  const sectionSrc = readFileSync(
    join(process.cwd(), "src/components/pod/PodPageGroupOrderSection.tsx"),
    "utf8"
  );
  const clientSrc = readFileSync(
    join(process.cwd(), "src/components/pod/PodPageGroupOrderCtaClient.tsx"),
    "utf8"
  );
  const startBtnSrc = readFileSync(
    join(process.cwd(), "src/components/cart/StartGroupOrderButton.tsx"),
    "utf8"
  );
  const quickCartSrc = readFileSync(
    join(process.cwd(), "src/components/cart/QuickCartContext.tsx"),
    "utf8"
  );
  const headerSrc = readFileSync(
    join(process.cwd(), "src/components/SiteHeaderNav.tsx"),
    "utf8"
  );
  const groupSectionSrc = readFileSync(
    join(process.cwd(), "src/components/cart/QuickCartGroupSection.tsx"),
    "utf8"
  );
  const cartPageSrc = readFileSync(join(process.cwd(), "src/app/cart/page.tsx"), "utf8");

  it("pod page start CTA uses client StartGroupOrderButton for signed-in users", () => {
    expect(sectionSrc).toContain("PodPageStartGroupOrderButton");
    expect(sectionSrc).toMatch(/session\?\.user[\s\S]*PodPageStartGroupOrderButton/);
    expect(clientSrc).toContain("StartGroupOrderButton");
    expect(startBtnSrc).toContain("startGroupOrderForPodAction");
    expect(startBtnSrc).toContain("dispatchGroupOrderStartCartSnapshot");
  });

  it("pod page start does not use redirect Link as primary JS path", () => {
    expect(clientSrc).toContain("quickCart?.openCart()");
    expect(clientSrc).toContain("<noscript>");
    expect(clientSrc).toContain("fallbackHref");
  });

  it("host active pod CTA opens Quick Cart instead of linking to /cart", () => {
    expect(sectionSrc).toContain("PodPageOpenQuickCartButton");
    expect(sectionSrc).not.toMatch(/host_active[\s\S]*href="\/cart"/);
    expect(clientSrc).toContain("quickCart?.openCart()");
  });

  it("Quick Cart group start keeps drawer open after start", () => {
    expect(groupSectionSrc).toContain("quickCart?.openCart()");
    expect(groupSectionSrc).not.toMatch(/onGroupStarted[\s\S]*onNavigate\?\(\)/);
  });

  it("Quick Cart enabled follows client pathname and active group state", () => {
    expect(quickCartSrc).toContain("isQuickCartEnabledForPath(pathname)");
    expect(quickCartSrc).toContain("hasActiveGroupOrder");
    expect(quickCartSrc).toContain("routeQuickCartEnabled || hasActiveGroupOrder");
    expect(quickCartSrc).toContain('detail.source === "group-order-ended"');
  });

  it("header cart opens Quick Cart when active empty group exists", () => {
    expect(headerSrc).toContain("canOpenQuickCart");
    expect(headerSrc).toContain("hasActiveGroupOrder");
    expect(headerSrc).toMatch(/canOpenQuickCart \?/);
    expect(headerSrc).not.toMatch(/itemCount\s*>\s*0[\s\S]*canOpenQuickCart/);
  });

  it("cart redirect fallback still exists for no-JS and cart page SSR start", () => {
    expect(sectionSrc).toContain("startGroupOrder=1");
    expect(cartPageSrc).toContain("startGroupOrder");
    expect(cartPageSrc).toContain("GroupOrderStartCartSync");
  });
});
