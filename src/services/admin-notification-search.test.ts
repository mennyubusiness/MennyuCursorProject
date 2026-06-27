import { describe, expect, it } from "vitest";
import {
  deriveSuppressionReason,
  isOtpNotificationEvent,
  maskPhoneForDisplay,
} from "@/services/admin-notification-search.service";

describe("admin notification search helpers", () => {
  it("masks phone numbers by default", () => {
    expect(maskPhoneForDisplay("***-***-1234", "1234")).toBe("***-***-1234");
    expect(maskPhoneForDisplay("+15551234567", "4567")).toBe("***-***-4567");
  });

  it("detects OTP / verification events", () => {
    expect(isOtpNotificationEvent("PHONE_VERIFICATION")).toBe(true);
    expect(isOtpNotificationEvent("ORDER_RECEIVED")).toBe(false);
  });

  it("derives suppression reason for skipped/suppressed statuses", () => {
    expect(deriveSuppressionReason("suppressed", "Missing transactional consent")).toContain("consent");
    expect(deriveSuppressionReason("sent", null)).toBeNull();
  });
});
