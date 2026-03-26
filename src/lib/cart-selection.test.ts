import { describe, expect, it } from "vitest";
import { selectCartForSessionAndPod } from "./cart-selection";

describe("selectCartForSessionAndPod", () => {
  it("returns undefined for empty list", () => {
    expect(selectCartForSessionAndPod([], "p1")).toBeUndefined();
  });

  it("prefers cart for preferredPodId when present", () => {
    const a = { podId: "older", updatedAt: 1 };
    const b = { podId: "target", updatedAt: 2 };
    expect(selectCartForSessionAndPod([a, b], "target")).toBe(b);
  });

  it("falls back to first row when preferred pod has no cart", () => {
    const first = { podId: "a" };
    const second = { podId: "b" };
    expect(selectCartForSessionAndPod([first, second], "missing")).toBe(first);
  });

  it("uses first row when preferredPodId is null", () => {
    const rows = [{ podId: "x" }, { podId: "y" }];
    expect(selectCartForSessionAndPod(rows, null)).toBe(rows[0]);
  });
});
