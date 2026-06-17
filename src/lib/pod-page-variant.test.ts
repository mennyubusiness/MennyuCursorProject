import { describe, expect, it } from "vitest";

import { isDestinationPodPage, resolvePodPageVariant } from "./pod-page-variant";

describe("pod-page-variant", () => {
  it("uses destination layout for downtown-food-pod slug", () => {
    expect(
      resolvePodPageVariant({
        podId: "any-id",
        podSlug: "downtown-food-pod",
      })
    ).toBe("destination");
  });

  it("uses standard layout for other slugs by default", () => {
    expect(
      resolvePodPageVariant({
        podId: "any-id",
        podSlug: "riverside-market",
      })
    ).toBe("standard");
  });

  it("allows query param override to destination", () => {
    expect(
      isDestinationPodPage({
        podId: "pod_1",
        podSlug: "riverside-market",
        variantParam: "destination",
      })
    ).toBe(true);
  });

  it("allows query param override to standard", () => {
    expect(
      isDestinationPodPage({
        podId: "pod_1",
        podSlug: "downtown-food-pod",
        variantParam: "standard",
      })
    ).toBe(false);
  });
});
