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
const phoneSectionSrc = readFileSync(join(dir, "AccountPhoneSection.tsx"), "utf8");
const sessionActionsSrc = readFileSync(join(dir, "AccountSessionActions.tsx"), "utf8");
const smsCheckboxSrc = readFileSync(
  join(dir, "../../components/legal/SmsConsentCheckbox.tsx"),
  "utf8"
);
const accountViewModelSrc = readFileSync(join(dir, "../../lib/account-page-view-model.ts"), "utf8");
const accountContextSrc = readFileSync(join(dir, "../../lib/account-page-context.ts"), "utf8");
const removeRouteSrc = readFileSync(
  join(dir, "../api/customer/account/phone/remove/route.ts"),
  "utf8"
);
const verifyCodeSrc = readFileSync(
  join(dir, "../api/customer/phone/verify-code/route.ts"),
  "utf8"
);

describe("account phone settings card", () => {
  it("uses Phone number title and compact helper copy", () => {
    expect(phoneSectionSrc).toMatch(/Phone number/);
    expect(phoneSectionSrc).toMatch(/Use your phone number for verification and optional order updates/);
    expect(phoneSectionSrc).toMatch(/track orders from the order status screen after checkout/);
    expect(phoneSectionSrc).not.toMatch(/Phone for order updates/);
  });

  it("shows Phone Number Optional label in edit mode", () => {
    expect(phoneSectionSrc).toMatch(/SmsPhoneNumberLabel/);
    expect(SMS_PHONE_NUMBER_LABEL).toBe("Phone Number");
    expect(SMS_PHONE_OPTIONAL_TAG).toBe("Optional");
  });

  it("shows current phone, verified status, and SMS on/off in read-only state", () => {
    expect(phoneSectionSrc).toMatch(/smsStatusLabel/);
    expect(phoneSectionSrc).toMatch(/Verified/);
    expect(phoneSectionSrc).toMatch(/SMS updates on/);
    expect(phoneSectionSrc).toMatch(/SMS updates off/);
    expect(phoneSectionSrc).toMatch(/checkoutPhone\.phoneDisplay/);
  });

  it("keeps Remove inside the phone card, not on the sign-out section", () => {
    expect(phoneSectionSrc).toMatch(/Remove/);
    expect(phoneSectionSrc).toMatch(/\/api\/customer\/account\/phone\/remove/);
    expect(sessionActionsSrc).not.toMatch(/Clear checkout phone/);
    expect(sessionActionsSrc).not.toMatch(/session\/clear/);
  });

  it("opens inline edit form when Change or Add is clicked", () => {
    expect(phoneSectionSrc).toMatch(/mode === "edit"/);
    expect(phoneSectionSrc).toMatch(/openEdit/);
    expect(phoneSectionSrc).toMatch(/Add phone number/);
    expect(phoneSectionSrc).toMatch(/\bChange\b/);
    expect(phoneSectionSrc).toMatch(/Enter mobile number/);
    expect(phoneSectionSrc).toMatch(/Send verification code/);
  });

  it("starts SMS checkbox unchecked and only prechecks for the same verified phone", () => {
    expect(phoneSectionSrc).toMatch(/useState\(false\)/);
    expect(phoneSectionSrc).toMatch(/storedSmsConsent/);
    expect(phoneSectionSrc).toMatch(/linkedPhoneE164/);
    expect(phoneSectionSrc).toMatch(/normalized\.e164 === linkedPhoneE164/);
  });

  it("requires SMS consent before sending verification code", () => {
    expect(phoneSectionSrc).toMatch(/if \(!smsConsent\)/);
    expect(phoneSectionSrc).toMatch(/Check SMS updates to receive a verification code/);
    expect(phoneSectionSrc).toMatch(/disabled={otpSending \|\| !phone\.trim\(\) \|\| !smsConsent}/);
  });

  it("shows order status tracking when SMS updates are off", () => {
    expect(phoneSectionSrc).toMatch(/!checkoutPhone\.smsUpdatesOn/);
    expect(phoneSectionSrc).toMatch(/track orders from the order status screen/);
  });

  it("removes phone and clears SMS consent via remove API", () => {
    expect(removeRouteSrc).toMatch(/removePhoneFromUserAccount/);
    expect(removeRouteSrc).toMatch(/revokeCustomerSessionFromRequest/);
    expect(accountContextSrc).toMatch(/hasTransactionalSmsConsent/);
    expect(accountViewModelSrc).toMatch(/smsUpdatesOn/);
  });

  it("records transactional SMS opt-in only when consent is granted on verify", () => {
    expect(verifyCodeSrc).toMatch(/smsConsent/);
    expect(verifyCodeSrc).toMatch(/recordSmsOptIn/);
    expect(verifyCodeSrc).not.toMatch(/marketing/i);
    expect(phoneSectionSrc).toMatch(/smsConsent,/);
  });

  it("uses transactional SMS disclosure with legal links (no marketing checkbox)", () => {
    expect(smsCheckboxSrc).toMatch(/SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL/);
    expect(smsCheckboxSrc).not.toMatch(/SMS_MARKETING/);
    expect(smsCheckboxSrc).not.toMatch(/smsMarketingConsent/);
    expect(SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL).toContain("order updates");
    expect(SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL).toContain("account notifications");
    expect(SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL).toContain("verification codes");
    expect(SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL).toContain("Open Order");
    expect(SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL).toMatch(/Message frequency may vary/i);
    expect(SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL).toMatch(/Message and data rates may apply/i);
    expect(SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL).toMatch(/Reply HELP for help/i);
    expect(SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL).toMatch(/STOP to opt-out/i);
    expect(smsCheckboxSrc).toMatch(/href="\/privacy"/);
    expect(smsCheckboxSrc).toMatch(/href="\/terms"/);
  });
});
