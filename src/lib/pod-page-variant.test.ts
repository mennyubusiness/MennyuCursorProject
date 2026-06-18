import { describe, expect, it } from "vitest";

import {
  DEFAULT_POD_PAGE_TEMPLATE,
  isClassicPodPage,
  isDestinationPodPage,
  resolvePodPageTemplate,
  resolvePodPageVariant,
} from "./pod-page-variant";

const baseInput = {
  podId: "pod_riverside",
  podSlug: "riverside-market",
};

describe("resolvePodPageTemplate", () => {
  it("defaults to destination with no query param or pod template", () => {
    expect(resolvePodPageTemplate(baseInput)).toBe("destination");
    expect(DEFAULT_POD_PAGE_TEMPLATE).toBe("destination");
  });

  it("defaults to destination for any pod slug without overrides", () => {
    expect(
      resolvePodPageTemplate({
        podId: "pod_downtown",
        podSlug: "downtown-food-pod",
      })
    ).toBe("destination");
  });

  it("resolves destination from ?variant=destination", () => {
    expect(resolvePodPageTemplate({ ...baseInput, variantParam: "destination" })).toBe(
      "destination"
    );
  });

  it("resolves classic fallback from ?variant=standard and ?variant=classic", () => {
    expect(resolvePodPageTemplate({ ...baseInput, variantParam: "standard" })).toBe("classic");
    expect(resolvePodPageTemplate({ ...baseInput, variantParam: "classic" })).toBe("classic");
  });

  it("falls back to destination for invalid query params", () => {
    expect(resolvePodPageTemplate({ ...baseInput, variantParam: "minimal" })).toBe("destination");
    expect(resolvePodPageTemplate({ ...baseInput, variantParam: "unknown" })).toBe("destination");
  });

  it("does not require env allowlist or demo slug for destination", () => {
    expect(process.env.DESTINATION_POD_IDS).toBeUndefined();
    expect(resolvePodPageTemplate(baseInput)).toBe("destination");
  });

  it("supports future pod-level template values when provided", () => {
    expect(resolvePodPageTemplate({ ...baseInput, podTemplate: "classic" })).toBe("classic");
    expect(resolvePodPageTemplate({ ...baseInput, podTemplate: "destination" })).toBe(
      "destination"
    );
    expect(resolvePodPageTemplate({ ...baseInput, podTemplate: "minimal" })).toBe("destination");
  });

  it("prefers valid query override over pod template", () => {
    expect(
      resolvePodPageTemplate({
        ...baseInput,
        variantParam: "classic",
        podTemplate: "destination",
      })
    ).toBe("classic");
  });

  it("ignores invalid query override even when pod template is classic", () => {
    expect(
      resolvePodPageTemplate({
        ...baseInput,
        variantParam: "bogus",
        podTemplate: "classic",
      })
    ).toBe("destination");
  });
});

describe("resolvePodPageVariant compatibility", () => {
  it("mirrors resolvePodPageTemplate", () => {
    expect(resolvePodPageVariant(baseInput)).toBe("destination");
    expect(resolvePodPageVariant({ ...baseInput, variantParam: "standard" })).toBe("classic");
  });
});

describe("template helpers", () => {
  it("identifies destination and classic pages", () => {
    expect(isDestinationPodPage(baseInput)).toBe(true);
    expect(isClassicPodPage(baseInput)).toBe(false);
    expect(isClassicPodPage({ ...baseInput, variantParam: "standard" })).toBe(true);
    expect(isDestinationPodPage({ ...baseInput, variantParam: "standard" })).toBe(false);
  });
});
