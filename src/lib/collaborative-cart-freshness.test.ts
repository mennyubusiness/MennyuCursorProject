import { describe, expect, it } from "vitest";
import { isGroupOrderSessionPollableStatus, shouldPollCollaborativeGroupCart } from "./collaborative-cart-freshness";

describe("collaborative-cart-freshness", () => {
  it("polls only active and locked_checkout", () => {
    expect(isGroupOrderSessionPollableStatus("active")).toBe(true);
    expect(isGroupOrderSessionPollableStatus("locked_checkout")).toBe(true);
    expect(isGroupOrderSessionPollableStatus("submitted")).toBe(false);
    expect(isGroupOrderSessionPollableStatus("ended")).toBe(false);
  });

  it("shouldPollCollaborativeGroupCart respects session + status", () => {
    expect(
      shouldPollCollaborativeGroupCart({ hasGroupSession: false, sessionStatus: "active" })
    ).toBe(false);
    expect(
      shouldPollCollaborativeGroupCart({ hasGroupSession: true, sessionStatus: "active" })
    ).toBe(true);
    expect(
      shouldPollCollaborativeGroupCart({ hasGroupSession: true, sessionStatus: "submitted" })
    ).toBe(false);
  });
});
