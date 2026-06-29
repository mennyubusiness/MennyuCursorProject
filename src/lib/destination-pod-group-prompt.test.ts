import { describe, expect, it } from "vitest";

import {
  destinationGroupPromptStorageKey,
  isDestinationGroupPromptDismissed,
  markDestinationGroupPromptDismissed,
  shouldOfferDestinationGroupOrderPrompt,
  shouldOpenDestinationGroupOrderPrompt,
} from "./destination-pod-group-prompt";

describe("destinationGroupPromptStorageKey", () => {
  it("uses a pod-specific sessionStorage key", () => {
    expect(destinationGroupPromptStorageKey("pod_123")).toBe(
      "openOrder.destinationGroupPromptDismissed.pod_123"
    );
  });
});

describe("shouldOfferDestinationGroupOrderPrompt", () => {
  it("offers the prompt on QR entry when vendors exist and user can start a group order", () => {
    expect(
      shouldOfferDestinationGroupOrderPrompt({
        hasVendors: true,
        isQrEntry: true,
        ctaStateKind: "start",
        orderingTone: "open",
      })
    ).toBe(true);
  });

  it("does not offer the prompt on regular (non-QR) entry", () => {
    expect(
      shouldOfferDestinationGroupOrderPrompt({
        hasVendors: true,
        isQrEntry: false,
        ctaStateKind: "start",
        orderingTone: "open",
      })
    ).toBe(false);
  });

  it("does not offer the prompt without vendors", () => {
    expect(
      shouldOfferDestinationGroupOrderPrompt({
        hasVendors: false,
        isQrEntry: true,
        ctaStateKind: "start",
        orderingTone: "open",
      })
    ).toBe(false);
  });

  it("does not offer the prompt when already in an active group order", () => {
    expect(
      shouldOfferDestinationGroupOrderPrompt({
        hasVendors: true,
        isQrEntry: true,
        ctaStateKind: "host_active",
        orderingTone: "open",
      })
    ).toBe(false);
    expect(
      shouldOfferDestinationGroupOrderPrompt({
        hasVendors: true,
        isQrEntry: true,
        ctaStateKind: "participant_active",
        orderingTone: "open",
      })
    ).toBe(false);
    expect(
      shouldOfferDestinationGroupOrderPrompt({
        hasVendors: true,
        isQrEntry: true,
        ctaStateKind: "locked_checkout",
        orderingTone: "open",
      })
    ).toBe(false);
  });

  it("does not offer the prompt when the pod has no listed vendors", () => {
    expect(
      shouldOfferDestinationGroupOrderPrompt({
        hasVendors: true,
        isQrEntry: true,
        ctaStateKind: "start",
        orderingTone: "empty",
      })
    ).toBe(false);
  });

  it("does not offer the prompt when join intent is explicit in the URL", () => {
    expect(
      shouldOfferDestinationGroupOrderPrompt({
        hasVendors: true,
        isQrEntry: true,
        ctaStateKind: "start",
        orderingTone: "open",
        hasExplicitJoinIntent: true,
      })
    ).toBe(false);
  });
});

describe("shouldOpenDestinationGroupOrderPrompt", () => {
  it("opens only when eligible and not dismissed", () => {
    expect(
      shouldOpenDestinationGroupOrderPrompt({
        offerPrompt: true,
        dismissed: false,
      })
    ).toBe(true);
    expect(
      shouldOpenDestinationGroupOrderPrompt({
        offerPrompt: true,
        dismissed: true,
      })
    ).toBe(false);
    expect(
      shouldOpenDestinationGroupOrderPrompt({
        offerPrompt: false,
        dismissed: false,
      })
    ).toBe(false);
  });
});

describe("destination group prompt dismissal storage", () => {
  it("marks and reads dismissal per pod", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };

    expect(isDestinationGroupPromptDismissed("pod_a", storage)).toBe(false);
    markDestinationGroupPromptDismissed("pod_a", storage);
    expect(isDestinationGroupPromptDismissed("pod_a", storage)).toBe(true);
    expect(isDestinationGroupPromptDismissed("pod_b", storage)).toBe(false);
  });
});
