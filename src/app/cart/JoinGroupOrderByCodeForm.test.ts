import { describe, expect, it } from "vitest";
import { normalizeGroupOrderJoinCodeInput } from "./JoinGroupOrderByCodeForm";

describe("normalizeGroupOrderJoinCodeInput", () => {
  it("trims, removes spaces, keeps 6 digits", () => {
    expect(normalizeGroupOrderJoinCodeInput("  12 34 56  ")).toBe("123456");
  });

  it("strips non-digits", () => {
    expect(normalizeGroupOrderJoinCodeInput("12-34-56")).toBe("123456");
  });
});
