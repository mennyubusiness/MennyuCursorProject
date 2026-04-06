import { describe, expect, it } from "vitest";
import { findDuplicatePluGroups } from "./deliverect-menu-integrity.service";

describe("findDuplicatePluGroups", () => {
  it("returns empty when all PLUs unique", () => {
    const m = findDuplicatePluGroups([
      { key: "A", id: "1" },
      { key: "B", id: "2" },
      { key: "C", id: "3" },
    ]);
    expect(m.size).toBe(0);
  });

  it("treats trimmed PLUs as same key", () => {
    const m = findDuplicatePluGroups([
      { key: "A", id: "1" },
      { key: "  A  ", id: "3" },
    ]);
    expect(m.get("A")).toEqual(["1", "3"]);
  });

  it("ignores empty keys", () => {
    const m = findDuplicatePluGroups([
      { key: "", id: "1" },
      { key: null, id: "2" },
      { key: "X", id: "3" },
    ]);
    expect(m.size).toBe(0);
  });

  it("detects triple duplicate", () => {
    const m = findDuplicatePluGroups([
      { key: "dup", id: "a" },
      { key: "dup", id: "b" },
      { key: "dup", id: "c" },
    ]);
    expect(m.get("dup")).toEqual(["a", "b", "c"]);
  });
});
