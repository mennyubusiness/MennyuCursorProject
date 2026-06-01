import { describe, expect, it } from "vitest";

import {
  buildOrderReadySmsBody,
  buildOrderReceivedSmsBody,
  buildPhoneVerificationSmsBody,
  formatSmsOrderNumber,
} from "@/lib/sms-templates";

describe("sms-templates", () => {
  it("formats order number from order id tail", () => {
    expect(formatSmsOrderNumber("ord_abc1234567890")).toBe("34567890");
  });

  it("phone verification template includes STOP language", () => {
    expect(buildPhoneVerificationSmsBody("123456")).toContain(
      "Open Order: Your verification code is 123456"
    );
    expect(buildPhoneVerificationSmsBody("123456")).toContain("Reply STOP to opt out");
  });

  it("order received template is transactional", () => {
    expect(buildOrderReceivedSmsBody("ABCD1234")).toContain(
      "Open Order: Your pickup order #ABCD1234 has been received"
    );
  });

  it("order ready template includes pickup code", () => {
    expect(buildOrderReadySmsBody("ABCD1234", "5678")).toContain("Pickup code: 5678");
  });
});
