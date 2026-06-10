import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  SMS_CHECKOUT_OPT_IN_LABEL,
  SMS_TRANSACTIONAL_COMPLIANCE_DISCLOSURE,
} from "@/lib/legal/sms-consent-copy";

const dir = dirname(fileURLToPath(import.meta.url));
const checkoutFormSrc = readFileSync(join(dir, "CheckoutForm.tsx"), "utf8");
const checkoutPhoneSrc = readFileSync(join(dir, "CheckoutPhoneVerification.tsx"), "utf8");
const smsCheckboxSrc = readFileSync(
  join(dir, "../../components/legal/SmsConsentCheckbox.tsx"),
  "utf8"
);

describe("checkout contact SMS UX", () => {
  it("does not show a required asterisk on mobile number", () => {
    expect(checkoutPhoneSrc).toMatch(/Mobile number \(optional\)/);
    expect(checkoutPhoneSrc).not.toMatch(/text-red-600">\*/);
    expect(checkoutPhoneSrc).not.toMatch(/\srequired/);
  });

  it("uses optional SMS helper copy in the contact section", () => {
    expect(checkoutFormSrc).toMatch(/Add a mobile number if you want SMS updates/);
    expect(checkoutFormSrc).toMatch(/track your order from the order[\s\S]*status screen after checkout/);
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
    expect(checkoutPhoneSrc).toMatch(/SMS updates are off\. After checkout, keep the order status page open/);
    expect(checkoutPhoneSrc).toMatch(
      /Phone verified\. SMS updates are off\. You can track this order from the order status screen\./
    );
  });

  it("shows SMS-on copy when phone is verified and consent is granted", () => {
    expect(checkoutPhoneSrc).toMatch(
      /Phone verified\. We\\u2019ll text order updates to this number\./
    );
  });

  it("uses checkout opt-in label with compliance disclosure and policy links", () => {
    expect(smsCheckboxSrc).toMatch(/layout === "checkout"/);
    expect(smsCheckboxSrc).toMatch(/SMS_CHECKOUT_OPT_IN_LABEL/);
    expect(smsCheckboxSrc).toMatch(/href="\/privacy"/);
    expect(smsCheckboxSrc).toMatch(/href="\/terms"/);
    expect(smsCheckboxSrc).toMatch(/Carriers are not liable for[\s\S]*delayed or undelivered messages/);
    expect(smsCheckboxSrc).toMatch(/Reply STOP to opt out or HELP for help/);
    expect(smsCheckboxSrc).toMatch(/type="checkbox"/);
    expect(smsCheckboxSrc).not.toMatch(/defaultChecked/);
    expect(SMS_CHECKOUT_OPT_IN_LABEL).toBe(
      "Send me transactional SMS updates for this order."
    );
    expect(SMS_TRANSACTIONAL_COMPLIANCE_DISCLOSURE).toContain("Privacy Policy");
  });

  it("routes successful checkout to the order status page", () => {
    expect(checkoutFormSrc).toMatch(/buildOrderStatusPath/);
    expect(checkoutFormSrc).toMatch(/payment:\s*"success"/);
  });
});
