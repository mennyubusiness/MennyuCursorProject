import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  SMS_PHONE_NUMBER_LABEL,
  SMS_PHONE_OPTIONAL_TAG,
  SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL,
} from "@/lib/legal/sms-consent-copy";

const dir = dirname(fileURLToPath(import.meta.url));
const checkoutFormSrc = readFileSync(join(dir, "CheckoutForm.tsx"), "utf8");
const checkoutPhoneSrc = readFileSync(join(dir, "CheckoutPhoneVerification.tsx"), "utf8");
const smsCheckboxSrc = readFileSync(
  join(dir, "../../components/legal/SmsConsentCheckbox.tsx"),
  "utf8"
);

describe("checkout contact SMS UX", () => {
  it("shows Phone Number label with Optional tag", () => {
    expect(checkoutPhoneSrc).toMatch(/SmsPhoneNumberLabel/);
    expect(SMS_PHONE_NUMBER_LABEL).toBe("Phone Number");
    expect(SMS_PHONE_OPTIONAL_TAG).toBe("Optional");
    expect(checkoutPhoneSrc).not.toMatch(/text-red-600">\*/);
    expect(checkoutPhoneSrc).not.toMatch(/\srequired/);
  });

  it("uses optional SMS helper copy in the contact section", () => {
    expect(checkoutPhoneSrc).toMatch(/We&apos;ll use this only for order updates if you choose SMS/);
    expect(checkoutFormSrc).toMatch(/CheckoutSectionCard/);
    expect(checkoutFormSrc).not.toMatch(
      /We&apos;ll use this to send order updates and help you find your order later\./
    );
  });

  it("starts SMS consent unchecked unless restored from server", () => {
    expect(checkoutFormSrc).toMatch(/initialSmsConsent/);
    expect(checkoutFormSrc).toMatch(/useState\(initialSmsConsent\)/);
    expect(checkoutPhoneSrc).not.toMatch(/useState\(true\)/);
  });

  it("does not block checkout solely because SMS consent is unchecked", () => {
    expect(checkoutFormSrc).not.toMatch(/if \(!phoneVerified\)/);
    expect(checkoutFormSrc).toMatch(/smsConsent && phone\.trim\(\) && !phoneVerified/);
    expect(checkoutFormSrc).toMatch(/smsConsent,/);
  });

  it("shows SMS-off copy when consent is not granted", () => {
    expect(checkoutPhoneSrc).toMatch(/You can still track your order on the order status page/);
    expect(checkoutPhoneSrc).toMatch(
      /Phone verified\. SMS updates are off\. You can track this order from the order status screen\./
    );
  });

  it("shows OTP panel only when SMS consent is checked and phone is present", () => {
    expect(checkoutPhoneSrc).toMatch(/showOtpPanel = smsConsent && !phoneVerified && Boolean\(phone\.trim\(\)\)/);
  });

  it("shows SMS-on copy when phone is verified and consent is granted", () => {
    expect(checkoutPhoneSrc).toMatch(
      /Phone verified\. We\\u2019ll text order updates to this number\./
    );
  });

  it("uses Twilio-aligned disclosure boxes with transactional opt-in and legal links", () => {
    expect(smsCheckboxSrc).toMatch(/SMS_MARKETING_NOT_OFFERED_LABEL/);
    expect(smsCheckboxSrc).toMatch(/SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL/);
    expect(smsCheckboxSrc).toMatch(/disabled/);
    expect(smsCheckboxSrc).toMatch(/href="\/privacy"/);
    expect(smsCheckboxSrc).toMatch(/href="\/terms"/);
    expect(smsCheckboxSrc).toMatch(/type="checkbox"/);
    expect(smsCheckboxSrc).not.toMatch(/defaultChecked/);
    expect(SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL).toContain("order updates");
    expect(SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL).toContain("account notifications");
    expect(SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL).toContain("verification codes");
    expect(SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL).toContain("Open Order");
    expect(SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL).toMatch(/Reply HELP for help/i);
    expect(SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL).toMatch(/STOP to opt-out/i);
  });

  it("routes successful checkout to the order status page", () => {
    expect(checkoutFormSrc).toMatch(/buildOrderStatusPath/);
    expect(checkoutFormSrc).toMatch(/payment:\s*"success"/);
  });
});
