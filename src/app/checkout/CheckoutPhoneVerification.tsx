"use client";

import { useState } from "react";

import { SmsConsentCheckbox } from "@/components/legal/SmsConsentCheckbox";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { normalizePhoneToE164US } from "@/lib/phone-e164";
import { MOBILE_MIN_TAP_TARGET_CLASS } from "@/lib/mobile-customer-ui";

type CheckoutPhoneVerificationProps = {
  phone: string;
  onPhoneChange: (phone: string) => void;
  phoneVerified: boolean;
  verifiedPhoneE164: string | null;
  smsConsent: boolean;
  onSmsConsentChange: (value: boolean) => void;
  onVerified: (phoneE164: string) => void;
  onResetVerification: () => void;
  /** Signed-in user with a linked verified phone on file (E.164). */
  accountVerifiedPhoneE164?: string | null;
  isSignedIn?: boolean;
};

export function CheckoutPhoneVerification({
  phone,
  onPhoneChange,
  phoneVerified,
  verifiedPhoneE164,
  smsConsent,
  onSmsConsentChange,
  onVerified,
  onResetVerification,
  accountVerifiedPhoneE164 = null,
  isSignedIn = false,
}: CheckoutPhoneVerificationProps) {
  const [otpCode, setOtpCode] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpMessage, setOtpMessage] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);

  async function handleSendCode() {
    setOtpError(null);
    setOtpMessage(null);
    if (!phone.trim()) {
      setOtpError("Enter your mobile number first.");
      return;
    }
    if (!smsConsent) {
      setOtpError("Check SMS updates to receive a verification code.");
      return;
    }
    setOtpSending(true);
    try {
      const res = await fetch("/api/customer/phone/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setOtpError(typeof data.error === "string" ? data.error : "Could not send code. Try again.");
        return;
      }
      setOtpMessage(
        typeof data.message === "string"
          ? data.message
          : "If this number can receive texts, we sent a verification code."
      );
    } catch {
      setOtpError("Could not send code. Try again.");
    } finally {
      setOtpSending(false);
    }
  }

  async function handleVerifyCode() {
    setOtpError(null);
    if (!phone.trim() || !otpCode.trim()) {
      setOtpError("Enter your phone and the 6-digit code.");
      return;
    }
    setOtpVerifying(true);
    try {
      const res = await fetch("/api/customer/phone/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone, code: otpCode.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setOtpError(typeof data.error === "string" ? data.error : "Verification failed.");
        return;
      }
      if (typeof data.phoneE164 === "string") {
        onVerified(data.phoneE164);
        setOtpCode("");
        setOtpMessage(null);
      }
    } catch {
      setOtpError("Verification failed. Try again.");
    } finally {
      setOtpVerifying(false);
    }
  }

  function matchesAccountVerifiedPhone(value: string): string | null {
    if (!isSignedIn || !accountVerifiedPhoneE164) return null;
    const normalized = normalizePhoneToE164US(value);
    if (!normalized.ok || normalized.e164 !== accountVerifiedPhoneE164) return null;
    return normalized.e164;
  }

  function handlePhoneInputChange(value: string) {
    const accountMatch = matchesAccountVerifiedPhone(value);
    if (accountMatch) {
      onPhoneChange(value);
      onVerified(accountMatch);
      setOtpCode("");
      setOtpMessage(null);
      setOtpError(null);
      return;
    }
    if (phoneVerified && verifiedPhoneE164) {
      onResetVerification();
      setOtpCode("");
      setOtpMessage(null);
      setOtpError(null);
    }
    onPhoneChange(value);
  }

  const showOtpPanel = smsConsent && !phoneVerified && Boolean(phone.trim());

  function verifiedStatusCopy(): string {
    if (phoneVerified && smsConsent) {
      return "Phone verified. We\u2019ll text order updates to this number.";
    }
    if (phoneVerified && !smsConsent) {
      return "Phone verified. SMS updates are off. You can track this order from the order status screen.";
    }
    return "";
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="phone" className="block text-sm font-semibold text-oo-charcoal">
          Mobile number <span className="font-normal text-oo-stone-gray">(optional)</span>
        </label>
        <p className="mt-1 text-sm text-oo-stone-gray">
          We&apos;ll use this only for order updates if you choose SMS.
        </p>
        <input
          id="phone"
          type="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => handlePhoneInputChange(e.target.value)}
          className="oo-input oo-input-touch mt-2 max-w-md"
          placeholder="(555) 123-4567"
        />
        <SmsConsentCheckbox
          id="checkout-sms-consent"
          layout="checkout"
          checked={smsConsent}
          onChange={onSmsConsentChange}
          className="mt-4 max-w-md"
        />
      </div>

      {phoneVerified ? (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
            <span aria-hidden="true">✓</span>
            Phone verified
          </p>
          <p className="mt-1 text-sm text-emerald-900/90">{verifiedStatusCopy()}</p>
        </div>
      ) : null}

      {!smsConsent && !phoneVerified ? (
        <p className="rounded-lg border border-oo-light-stone bg-oo-cream/60 px-3 py-3 text-sm text-oo-stone-gray" role="status">
          You can still track your order on the order status page.
        </p>
      ) : null}

      {showOtpPanel ? (
        <div className="rounded-xl border border-oo-light-stone bg-oo-cream/70 p-4">
          <p className="text-sm font-semibold text-oo-charcoal">Verify your number for SMS updates</p>
          <p className="mt-1 text-sm text-oo-stone-gray">
            We&apos;ll text a one-time code to confirm this number.
          </p>
          <div className="mt-4 space-y-3">
            <button
              type="button"
              onClick={handleSendCode}
              disabled={otpSending || !phone.trim()}
              className={cn(
                buttonClassName({ variant: "secondary", size: "touch" }),
                "w-full sm:w-auto"
              )}
            >
              {otpSending ? "Sending…" : "Send code"}
            </button>
            <div>
              <label htmlFor="otp-code" className="block text-sm font-semibold text-oo-charcoal">
                6-digit code
              </label>
              <input
                id="otp-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="oo-input oo-input-touch mt-2 max-w-[12rem] tracking-widest"
                placeholder="000000"
              />
            </div>
            <button
              type="button"
              onClick={handleVerifyCode}
              disabled={otpVerifying || otpCode.length !== 6}
              className={cn(
                buttonClassName({ variant: "primary", size: "touch" }),
                MOBILE_MIN_TAP_TARGET_CLASS,
                "w-full sm:w-auto"
              )}
            >
              {otpVerifying ? "Verifying…" : "Verify number"}
            </button>
          </div>
          {otpMessage ? (
            <p className="mt-3 text-sm text-oo-stone-gray" role="status">
              {otpMessage}
            </p>
          ) : null}
          {otpError ? (
            <p className="mt-3 text-sm font-medium text-red-700" role="alert">
              {otpError}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
