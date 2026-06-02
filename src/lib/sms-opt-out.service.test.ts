import { describe, expect, it } from "vitest";

import { normalizeSmsPhoneE164 } from "@/lib/sms-opt-out.service";

describe("normalizeSmsPhoneE164", () => {
  it("normalizes Twilio-style US numbers", () => {
    expect(normalizeSmsPhoneE164("+15551234567")).toBe("+15551234567");
    expect(normalizeSmsPhoneE164("(555) 123-4567")).toBe("+15551234567");
    expect(normalizeSmsPhoneE164("15551234567")).toBe("+15551234567");
  });
});
