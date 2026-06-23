import { describe, expect, it } from "vitest";

import {
  buildPodCustomerPath,
  buildPodOrderingAbsoluteUrl,
  buildVendorMenuCustomerPath,
  isCustomerPodSlugPath,
  parseCustomerPodSlugPath,
} from "./customer-public-url";
import { POD_QR_ENTRY_PARAM, POD_QR_ENTRY_VALUE } from "./pod-ordering-url";

describe("customer-public-url", () => {
  it("builds canonical pod and vendor paths", () => {
    expect(buildPodCustomerPath("willamette-garage")).toBe("/willamette-garage");
    expect(buildVendorMenuCustomerPath("willamette-garage", "billys-jams-and-crams")).toBe(
      "/willamette-garage/billys-jams-and-crams"
    );
  });

  it("adds QR entry query param when requested", () => {
    expect(buildPodCustomerPath("downtown-food-pod", { entry: POD_QR_ENTRY_VALUE })).toBe(
      `/downtown-food-pod?${POD_QR_ENTRY_PARAM}=${POD_QR_ENTRY_VALUE}`
    );
    expect(buildPodOrderingAbsoluteUrl("https://mennyu.com", "downtown-food-pod")).toBe(
      `https://mennyu.com/downtown-food-pod?${POD_QR_ENTRY_PARAM}=${POD_QR_ENTRY_VALUE}`
    );
  });

  it("parses slug routes and rejects reserved segments", () => {
    expect(parseCustomerPodSlugPath("/willamette-garage")).toEqual({
      podSlug: "willamette-garage",
    });
    expect(parseCustomerPodSlugPath("/willamette-garage/billys-jams-and-crams")).toEqual({
      podSlug: "willamette-garage",
      vendorSlug: "billys-jams-and-crams",
    });
    expect(parseCustomerPodSlugPath("/cart")).toBeNull();
    expect(parseCustomerPodSlugPath("/checkout")).toBeNull();
    expect(parseCustomerPodSlugPath("/admin/pods")).toBeNull();
  });

  it("detects customer pod slug paths", () => {
    expect(isCustomerPodSlugPath("/riverside-market")).toBe(true);
    expect(isCustomerPodSlugPath("/riverside-market/taco-fiesta")).toBe(true);
    expect(isCustomerPodSlugPath("/explore")).toBe(false);
  });
});
