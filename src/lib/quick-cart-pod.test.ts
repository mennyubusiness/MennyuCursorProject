import { describe, expect, it } from "vitest";
import { resolveCurrentPodId } from "./quick-cart-pod";

describe("resolveCurrentPodId", () => {
  it("prefers route pod over cookie", () => {
    expect(
      resolveCurrentPodId({ routePodId: "pod_b", cookiePodId: "pod_a" })
    ).toBe("pod_b");
  });

  it("falls back to cookie when not on a pod route", () => {
    expect(resolveCurrentPodId({ routePodId: null, cookiePodId: "pod_a" })).toBe(
      "pod_a"
    );
  });

  it("returns null when neither route nor cookie is set", () => {
    expect(resolveCurrentPodId({ routePodId: null, cookiePodId: null })).toBeNull();
  });
});
