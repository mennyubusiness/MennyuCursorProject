import { describe, expect, it } from "vitest";
import {
  normalizeGroupOrderJoinCode,
  parseGroupOrderJoinCodeDigits,
} from "@/lib/group-order-join-code";

describe("group-order-join-code", () => {
  it("normalizeGroupOrderJoinCode pads to six digits for display helpers", () => {
    expect(normalizeGroupOrderJoinCode("42")).toBe("000042");
    expect(normalizeGroupOrderJoinCode("1234567")).toBe("123456");
  });

  it("parseGroupOrderJoinCodeDigits rejects non-six-digit input", () => {
    expect(parseGroupOrderJoinCodeDigits("123")).toBeNull();
    expect(parseGroupOrderJoinCodeDigits("1234567")).toBeNull();
    expect(parseGroupOrderJoinCodeDigits("12-34-56")).toBe("123456");
  });
});
