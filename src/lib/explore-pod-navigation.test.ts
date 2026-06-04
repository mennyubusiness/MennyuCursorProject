import { describe, expect, it } from "vitest";

import { getPodPageHref } from "./explore-pod-navigation";

describe("explore-pod-navigation", () => {
  it("pod card href navigates to pod detail route", () => {
    expect(getPodPageHref("p1")).toBe("/pod/p1");
    expect(getPodPageHref("  cuid_abc  ")).toBe("/pod/cuid_abc");
  });

  it("does not use explore query param for primary pod navigation", () => {
    const href = getPodPageHref("p1");
    expect(href).not.toContain("/explore");
    expect(href).not.toContain("?pod=");
  });
});

describe("explore-pod-filter-url", () => {
  it("buildExplorePodFilterUrl does not trigger scroll (URL-only helper)", async () => {
    const { buildExplorePodFilterUrl } = await import("./explore-pod-filter-url");
    expect(buildExplorePodFilterUrl(new URLSearchParams(), null)).toBe("/explore");
    expect(buildExplorePodFilterUrl(new URLSearchParams("foo=bar"), "p1")).toBe(
      "/explore?foo=bar&pod=p1"
    );
  });
});

describe("ExploreDiscovery scroll guard", () => {
  it("ExploreDiscovery source does not call scrollIntoView on pod cards", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const file = await fs.readFile(
      path.join(process.cwd(), "src/components/explore/ExploreDiscovery.tsx"),
      "utf8"
    );
    expect(file).not.toContain("scrollIntoView");
    expect(file).not.toContain("onSelectPod");
  });
});
