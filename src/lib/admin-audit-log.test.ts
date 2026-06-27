import { describe, expect, it } from "vitest";
import {
  ADMIN_AUDIT_ACTION,
  normalizeAdminReason,
  requireAdminReason,
  serializeAuditValue,
} from "@/lib/admin-audit-log";

describe("admin audit log helpers", () => {
  it("requireAdminReason rejects short or empty reasons", () => {
    expect(requireAdminReason("")).toEqual({ ok: false, error: "A reason of at least 3 characters is required." });
    expect(requireAdminReason("ab")).toEqual({ ok: false, error: "A reason of at least 3 characters is required." });
  });

  it("requireAdminReason accepts trimmed reasons", () => {
    expect(requireAdminReason("  launch support  ")).toEqual({ ok: true, reason: "launch support" });
  });

  it("normalizeAdminReason truncates very long reasons", () => {
    const long = "x".repeat(2500);
    expect(normalizeAdminReason(long)?.length).toBe(2000);
  });

  it("serializeAuditValue handles primitives and objects", () => {
    expect(serializeAuditValue(null)).toBeNull();
    expect(serializeAuditValue("active")).toBe("active");
    expect(serializeAuditValue({ disabledAt: null })).toBe('{"disabledAt":null}');
  });

  it("defines sprint action types", () => {
    expect(ADMIN_AUDIT_ACTION.USER_DISABLED).toBe("USER_DISABLED");
    expect(ADMIN_AUDIT_ACTION.INVITE_ATTACHMENT_REPAIRED).toBe("INVITE_ATTACHMENT_REPAIRED");
    expect(ADMIN_AUDIT_ACTION.VENDOR_ORDERING_PAUSED).toBe("VENDOR_ORDERING_PAUSED");
    expect(ADMIN_AUDIT_ACTION.POD_ORDERING_PAUSED).toBe("POD_ORDERING_PAUSED");
    expect(ADMIN_AUDIT_ACTION.SLUG_CHANGED).toBe("SLUG_CHANGED");
    expect(ADMIN_AUDIT_ACTION.QR_REGENERATED).toBe("QR_REGENERATED");
  });
});
