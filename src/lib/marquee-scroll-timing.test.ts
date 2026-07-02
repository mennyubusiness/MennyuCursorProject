import { describe, expect, it } from "vitest";

import {
  ADMIN_MARQUEE_DESKTOP_DURATION_S,
  ADMIN_MARQUEE_ITEM_COUNT,
  ADMIN_MARQUEE_MOBILE_DURATION_S,
  ADMIN_MARQUEE_REFERENCE_LABEL,
  getMarqueeDurationToMatchAdminBanner,
} from "./marquee-scroll-timing";

describe("getMarqueeDurationToMatchAdminBanner", () => {
  it("matches admin banner duration for the admin reference row", () => {
    const items = Array.from({ length: ADMIN_MARQUEE_ITEM_COUNT }, () => ADMIN_MARQUEE_REFERENCE_LABEL);
    const duration = getMarqueeDurationToMatchAdminBanner(items);

    expect(duration.mobileSeconds).toBe(ADMIN_MARQUEE_MOBILE_DURATION_S);
    expect(duration.desktopSeconds).toBe(ADMIN_MARQUEE_DESKTOP_DURATION_S);
  });

  it("slows wider destination pod rows proportionally", () => {
    const items = Array.from({ length: 24 }, () => "HAPPY BURGER STAND");
    const duration = getMarqueeDurationToMatchAdminBanner(items);

    expect(duration.mobileSeconds).toBeGreaterThan(ADMIN_MARQUEE_MOBILE_DURATION_S);
    expect(duration.desktopSeconds).toBeGreaterThan(ADMIN_MARQUEE_DESKTOP_DURATION_S);
  });
});
