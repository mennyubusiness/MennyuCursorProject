import { describe, expect, it } from "vitest";
import {
  getBrowsingPodIdFromClient,
  resolveBrowsingPodId,
  resolveCurrentPodId,
} from "./quick-cart-pod";

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
