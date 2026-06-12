import { describe, expect, it } from "vitest";
import {
  cartLineOrderabilityCode,
  cartLineOrderabilityMessage,
  getVendorOrderabilityInPod,
  isVendorOrderableInPod,
} from "./vendor-orderability-in-pod";

const openVendor = { isActive: true, mennyuOrdersPaused: false };

describe("getVendorOrderabilityInPod", () => {
  it("blocks inactive pod", () => {
    const result = getVendorOrderabilityInPod({
      podActive: false,
      podVendorExists: true,
      podVendorActive: true,
      vendor: openVendor,
    });
    expect(result.orderable).toBe(false);
    expect(result.code).toBe("POD_INACTIVE");
    expect(result.message).toMatch(/not currently accepting orders/i);
  });

  it("blocks missing pod vendor relationship", () => {
    const result = getVendorOrderabilityInPod({
      podActive: true,
      podVendorExists: false,
      podVendorActive: false,
      vendor: openVendor,
    });
    expect(result.orderable).toBe(false);
    expect(result.code).toBe("VENDOR_NOT_IN_POD");
  });

  it("blocks pod-vendor paused in pod", () => {
    const result = getVendorOrderabilityInPod({
      podActive: true,
      podVendorExists: true,
      podVendorActive: false,
      vendor: openVendor,
    });
    expect(result.orderable).toBe(false);
    expect(result.code).toBe("VENDOR_PAUSED_IN_POD");
  });

  it("blocks vendor global pause after pod checks pass", () => {
    const result = getVendorOrderabilityInPod({
      podActive: true,
      podVendorExists: true,
      podVendorActive: true,
      vendor: { isActive: true, mennyuOrdersPaused: true },
    });
    expect(result.orderable).toBe(false);
    expect(result.code).toBe("VENDOR_PAUSED_MENNYU");
    expect(result.message).toMatch(/paused right now/i);
  });

  it("allows fully orderable vendor", () => {
    expect(
      isVendorOrderableInPod({
        podActive: true,
        podVendorExists: true,
        podVendorActive: true,
        vendor: openVendor,
      })
    ).toBe(true);
  });
});

describe("cart line helpers", () => {
  it("maps pod-vendor pause to checkout copy", () => {
    const result = getVendorOrderabilityInPod({
      podActive: true,
      podVendorExists: true,
      podVendorActive: false,
      vendor: openVendor,
    });
    expect(cartLineOrderabilityCode(result)).toBe("VENDOR_PAUSED_IN_POD");
    expect(cartLineOrderabilityMessage(result)).toMatch(/no longer accepting orders at this pod/i);
  });
});
