import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL } from "./sms-consent-copy";

const root = join(process.cwd(), "src");

describe("sms-consent-copy", () => {
  it("uses OpenOrder brand and required transactional message types", () => {
    expect(SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL).toContain("OpenOrder");
    expect(SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL).toContain("verification codes");
    expect(SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL).toContain("order issue notices");
    expect(SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL).toContain("Reply STOP");
    expect(SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL).not.toMatch(/marketing/i);
  });
});

describe("SMS compliance pages and forms", () => {
  const privacySrc = readFileSync(join(root, "app/privacy/PrivacyPolicyContent.tsx"), "utf8");
  const termsSrc = readFileSync(join(root, "app/terms/TermsOfServiceContent.tsx"), "utf8");
  const smsPageSrc = readFileSync(join(root, "app/sms-consent/SmsConsentPageContent.tsx"), "utf8");
  const footerSrc = readFileSync(join(root, "components/layout/site-footer.tsx"), "utf8");
  const checkoutPhoneSrc = readFileSync(join(root, "app/checkout/CheckoutPhoneVerification.tsx"), "utf8");
  const accountPhoneSrc = readFileSync(join(root, "app/account/AccountPhoneSection.tsx"), "utf8");
  const groupJoinSrc = readFileSync(join(root, "app/group-order/join/GroupOrderJoinForm.tsx"), "utf8");
  const checkboxSrc = readFileSync(join(root, "components/legal/SmsConsentCheckbox.tsx"), "utf8");

  it("privacy policy includes SMS non-sharing language", () => {
    expect(privacySrc).toMatch(/does not sell, rent, share, or transfer mobile phone numbers/);
    expect(privacySrc).toMatch(/opt-in data and consent are used only to provide transactional messaging/);
  });

  it("terms include transactional SMS program language", () => {
    expect(termsSrc).toMatch(/does not send marketing or promotional SMS messages/);
    expect(termsSrc).toMatch(/replying.*STOP/);
  });

  it("public SMS consent page documents opt-in locations and checkbox copy", () => {
    expect(smsPageSrc).toMatch(/Where customers opt in/);
    expect(smsPageSrc).toMatch(/SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL/);
    expect(smsPageSrc).toMatch(/\/privacy/);
    expect(smsPageSrc).toMatch(/\/terms/);
  });

  it("footer links to privacy, terms, and SMS consent", () => {
    expect(footerSrc).toMatch(/href="\/privacy"/);
    expect(footerSrc).toMatch(/href="\/terms"/);
    expect(footerSrc).toMatch(/href="\/sms-consent"/);
  });

  it("phone collection points use unchecked SMS consent checkbox", () => {
    expect(checkoutPhoneSrc).toMatch(/SmsConsentCheckbox/);
    expect(checkoutPhoneSrc).toMatch(/useState\(false\)/);
    expect(accountPhoneSrc).toMatch(/SmsConsentCheckbox/);
    expect(accountPhoneSrc).toMatch(/smsConsent/);
    expect(groupJoinSrc).toMatch(/SmsConsentCheckbox/);
    expect(checkboxSrc).toMatch(/type="checkbox"/);
    expect(checkboxSrc).not.toMatch(/defaultChecked/);
  });
});
