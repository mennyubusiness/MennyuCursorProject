import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockRecordSmsOptOut = vi.fn();
const mockRecordSmsOptIn = vi.fn();

vi.mock("@/lib/sms-opt-out.service", () => ({
  normalizeSmsPhoneE164: (raw: string) => (raw.startsWith("+") ? raw : null),
  recordSmsOptOut: (...args: unknown[]) => mockRecordSmsOptOut(...args),
  recordSmsOptIn: (...args: unknown[]) => mockRecordSmsOptIn(...args),
}));

vi.mock("@/lib/twilio-webhook", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/twilio-webhook")>();
  return {
    ...mod,
    validateTwilioWebhookRequest: () => true,
    readTwilioWebhookParams: async () => ({
      From: "+15551234567",
      To: "+15559876543",
      Body: "STOP",
    }),
  };
});

import { POST } from "./route";

describe("POST /api/twilio/inbound-sms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns TwiML for STOP and records opt-out", async () => {
    const req = new NextRequest("http://localhost/api/twilio/inbound-sms", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "From=%2B15551234567&Body=STOP",
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/xml");
    const xml = await res.text();
    expect(xml).toContain("unsubscribed");
    expect(mockRecordSmsOptOut).toHaveBeenCalledWith("+15551234567");
  });
});
