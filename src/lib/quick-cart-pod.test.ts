import { describe, expect, it } from "vitest";
import {
  getBrowsingPodIdFromClient,
  resolveBrowsingPodId,
  resolveCurrentPodId,
  resolveQuickCartBrowsePod,
} from "./quick-cart-pod";

describe("resolveQuickCartBrowsePod", () => {
  it("prefers server-resolved page pod over client route hints", () => {
    expect(
      resolveQuickCartBrowsePod({
        id: "pod_page",
        slug: "riverside",
        name: "Riverside Pod",
      })
    ).toEqual({
      id: "pod_page",
      slug: "riverside",
      name: "Riverside Pod",
    });
  });

  it("returns null browse pod when page pod is absent", () => {
    expect(resolveQuickCartBrowsePod(null)).toEqual({
      id: null,
      name: null,
      slug: null,
    });
  });
});

describe("resolveBrowsingPodId", () => {
  it("uses route pod only", () => {
    expect(resolveBrowsingPodId({ routePodId: "pod_b" })).toBe("pod_b");
    expect(resolveBrowsingPodId({ routePodId: null })).toBeNull();
  });
});

describe("resolveCurrentPodId (legacy)", () => {
  it("prefers route pod over cookie when both provided", () => {
    expect(
      resolveCurrentPodId({ routePodId: "pod_b", cookiePodId: "pod_a" })
    ).toBe("pod_b");
  });

  it("falls back to cookie when not on a pod route", () => {
    expect(resolveCurrentPodId({ routePodId: null, cookiePodId: "pod_a" })).toBe(
      "pod_a"
    );
  });
});

describe("getBrowsingPodIdFromClient", () => {
  it("does not read cookie (neutral cart without visiting a pod route)", () => {
    expect(getBrowsingPodIdFromClient()).toBeNull();
  });
});
