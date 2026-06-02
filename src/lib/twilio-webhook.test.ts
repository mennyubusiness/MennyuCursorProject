import { describe, expect, it } from "vitest";

import {
  classifyInboundSmsBody,
  resolveTwilioWebhookRequestUrl,
  TWILIO_INBOUND_HELP_REPLY,
  TWILIO_INBOUND_OTHER_REPLY,
  TWILIO_INBOUND_START_REPLY,
  TWILIO_INBOUND_STOP_REPLY,
} from "@/lib/twilio-webhook";

describe("twilio inbound SMS classification", () => {
  it("STOP keyword", () => {
    expect(classifyInboundSmsBody("STOP")).toBe("stop");
    expect(classifyInboundSmsBody("  stop  ")).toBe("stop");
    expect(classifyInboundSmsBody("UNSUBSCRIBE")).toBe("stop");
  });

  it("START keyword", () => {
    expect(classifyInboundSmsBody("START")).toBe("start");
    expect(classifyInboundSmsBody("yes")).toBe("start");
  });

  it("HELP keyword", () => {
    expect(classifyInboundSmsBody("HELP")).toBe("help");
    expect(classifyInboundSmsBody("info")).toBe("help");
  });

  it("unknown reply", () => {
    expect(classifyInboundSmsBody("Thanks!")).toBe("other");
  });

  it("reply copy includes support email on HELP", () => {
    expect(TWILIO_INBOUND_HELP_REPLY).toContain("openorder.business@gmail.com");
    expect(TWILIO_INBOUND_STOP_REPLY).toContain("unsubscribed");
    expect(TWILIO_INBOUND_START_REPLY).toContain("transactional");
    expect(TWILIO_INBOUND_OTHER_REPLY).toContain("automated pickup order notifications");
  });
});

describe("resolveTwilioWebhookRequestUrl", () => {
  it("uses forwarded host/proto for signature validation behind proxy", () => {
    const url = resolveTwilioWebhookRequestUrl({
      url: "http://internal:3000/api/twilio/inbound-sms",
      nextUrl: { pathname: "/api/twilio/inbound-sms", search: "" },
      headers: new Headers({
        "x-forwarded-host": "app.openorder.co",
        "x-forwarded-proto": "https",
      }),
    });
    expect(url).toBe("https://app.openorder.co/api/twilio/inbound-sms");
  });
});
