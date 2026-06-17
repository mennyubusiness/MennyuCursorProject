import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  SMS_ACTIVE_OPT_IN_PATHS,
  SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL,
} from "./sms-consent-copy";

const root = join(process.cwd(), "src");

describe("sms-consent-copy", () => {
  it("uses Open Order brand and required transactional message types", () => {
    expect(SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL).toContain("Open Order");
    expect(SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL).not.toContain("OpenOrder");
    expect(SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL).toContain("verification codes");
    expect(SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL).toContain("order issue notifications");
    expect(SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL).toContain("Reply STOP");
    expect(SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL).toContain(
      "Carriers are not liable for delayed or undelivered messages"
    );
    expect(SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL).not.toMatch(/marketing/i);
    expect(SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL).not.toMatch(/completed-order/i);
  });

  it("lists only active opt-in paths without group order join", () => {
    expect(SMS_ACTIVE_OPT_IN_PATHS).toHaveLength(3);
    expect(SMS_ACTIVE_OPT_IN_PATHS.join(" ")).toMatch(/Checkout/);
    expect(SMS_ACTIVE_OPT_IN_PATHS.join(" ")).toMatch(/Account phone/);
    expect(SMS_ACTIVE_OPT_IN_PATHS.join(" ")).toMatch(/START keyword/);
    expect(SMS_ACTIVE_OPT_IN_PATHS.join(" ")).not.toMatch(/group order join/i);
  });
});

describe("SMS compliance pages and forms", () => {
  const privacySrc = readFileSync(join(root, "app/privacy/PrivacyPolicyContent.tsx"), "utf8");
  const termsSrc = readFileSync(join(root, "app/terms/TermsOfServiceContent.tsx"), "utf8");
  const smsPageSrc = readFileSync(join(root, "app/sms-consent/SmsConsentPageContent.tsx"), "utf8");
  const smsMockSrc = readFileSync(join(root, "app/sms-consent/SmsConsentReviewerMockups.tsx"), "utf8");
  const footerSrc = readFileSync(join(root, "components/layout/site-footer.tsx"), "utf8");
  const checkoutFormSrc = readFileSync(join(root, "app/checkout/CheckoutForm.tsx"), "utf8");
  const checkoutPageSrc = readFileSync(join(root, "app/checkout/page.tsx"), "utf8");
  const checkoutPhoneSrc = readFileSync(join(root, "app/checkout/CheckoutPhoneVerification.tsx"), "utf8");
  const accountPhoneSrc = readFileSync(join(root, "app/account/AccountPhoneSection.tsx"), "utf8");
  const groupJoinSrc = readFileSync(join(root, "app/group-order/join/GroupOrderJoinForm.tsx"), "utf8");
  const checkboxSrc = readFileSync(join(root, "components/legal/SmsConsentCheckbox.tsx"), "utf8");
  const templatesSrc = readFileSync(join(root, "lib/sms-templates.ts"), "utf8");

  it("privacy policy includes SMS non-sharing language and Open Order brand", () => {
    expect(privacySrc).toMatch(/does not sell, rent, share, or transfer mobile phone numbers/);
    expect(privacySrc).toMatch(/opt-in data and consent are used only to provide transactional messaging/);
    expect(privacySrc).toMatch(/Open Order does not sell/);
    expect(privacySrc).not.toMatch(/completed-order/i);
  });

  it("terms include transactional SMS program language", () => {
    expect(termsSrc).toMatch(/does not send marketing or promotional SMS messages/);
    expect(termsSrc).toMatch(/replying.*STOP/);
    expect(termsSrc).toMatch(/Carriers are not liable for delayed or undelivered messages/);
    expect(termsSrc).toMatch(/from Open Order/);
    expect(termsSrc).not.toMatch(/completed-order/i);
  });

  it("public SMS consent page documents opt-in paths, reviewer mockups, and disclosures", () => {
    expect(smsPageSrc).toMatch(/Supported SMS opt-in paths/);
    expect(smsPageSrc).toMatch(/SMS_ACTIVE_OPT_IN_PATHS/);
    expect(smsPageSrc).toMatch(/not.*an SMS opt-in path/);
    expect(SMS_ACTIVE_OPT_IN_PATHS.join(" ")).not.toMatch(/group order join/i);
    expect(smsPageSrc).toMatch(/SmsConsentCheckoutReviewerMockup/);
    expect(smsPageSrc).toMatch(/SmsConsentAccountReviewerMockup/);
    expect(smsPageSrc).toMatch(/START keyword/);
    expect(smsPageSrc).toMatch(/Message frequency varies/);
    expect(smsPageSrc).toMatch(/Message and data rates may apply/);
    expect(smsPageSrc).toMatch(/Reply STOP/);
    expect(smsPageSrc).toMatch(/Reply HELP/);
    expect(smsPageSrc).toMatch(/OPEN_ORDER_SUPPORT_EMAIL/);
    expect(smsPageSrc).toMatch(/\/privacy/);
    expect(smsPageSrc).toMatch(/\/terms/);
    expect(smsPageSrc).toMatch(/consent is stored when the order is placed/);
    expect(smsMockSrc).toMatch(/data-sms-reviewer-mockup/);
    expect(smsMockSrc).toMatch(/href="\/privacy"/);
    expect(smsMockSrc).toMatch(/href="\/terms"/);
  });

  it("footer links to privacy, terms, and SMS consent", () => {
    expect(footerSrc).toMatch(/href="\/privacy"/);
    expect(footerSrc).toMatch(/href="\/terms"/);
    expect(footerSrc).toMatch(/href="\/sms-consent"/);
  });

  it("checkout and account use unchecked SMS consent checkbox", () => {
    expect(checkoutFormSrc).toMatch(/useState\(initialSmsConsent\)/);
    expect(checkoutPageSrc).toMatch(/hasTransactionalSmsConsent/);
    expect(checkoutPhoneSrc).toMatch(/SmsConsentCheckbox/);
    expect(accountPhoneSrc).toMatch(/SmsConsentCheckbox/);
    expect(accountPhoneSrc).toMatch(/smsConsent/);
    expect(checkboxSrc).toMatch(/type="checkbox"/);
    expect(checkboxSrc).not.toMatch(/defaultChecked/);
  });

  it("group join does not collect SMS consent", () => {
    expect(groupJoinSrc).not.toMatch(/SmsConsentCheckbox/);
    expect(groupJoinSrc).not.toMatch(/smsConsent/);
    expect(groupJoinSrc).toMatch(/group order coordination/i);
  });

  it("account requires SMS consent before sending verification code", () => {
    expect(accountPhoneSrc).toMatch(/if \(!smsConsent\)/);
    expect(accountPhoneSrc).toMatch(/disabled={otpSending \|\| !phone\.trim\(\) \|\| !smsConsent}/);
  });

  it("ORDER_RECEIVED template includes HELP language", () => {
    expect(templatesSrc).toMatch(/Reply HELP for help or STOP to opt out/);
  });
});
