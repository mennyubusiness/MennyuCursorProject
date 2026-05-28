import { describe, expect, it } from "vitest";
import { operationalMenuCacheTag } from "@/services/menu-active-scope.service";

describe("menu-active-scope cache", () => {
  it("operationalMenuCacheTag is vendor-scoped", () => {
    expect(operationalMenuCacheTag("vendor_abc")).toBe("operational-menu:vendor_abc");
  });
});
