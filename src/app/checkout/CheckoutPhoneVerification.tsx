"use client";

import { useState } from "react";

import { SmsConsentCheckbox } from "@/components/legal/SmsConsentCheckbox";
import { normalizePhoneToE164US } from "@/lib/phone-e164";

type CheckoutPhoneVerificationProps = {
  phone: string;
  onPhoneChange: (phone: string) => void;
  phoneVerified: boolean;
  verifiedPhoneE164: string | null;
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
  onVerified,
  onResetVerification,
  accountVerifiedPhoneE164 = null,
  isSignedIn = false,
}: CheckoutPhoneVerificationProps) {
  const [otpCode, setOtpCode] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
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
      setOtpError("Agree to transactional SMS messages before we send a verification code.");
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
    if (!smsConsent) {
      setOtpError("Agree to transactional SMS messages to verify your phone.");
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

  const showOtpPanel = !phoneVerified;

  return (
    <div className="mt-4 space-y-4">
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-stone-800">
          Mobile number <span className="text-red-600">*</span>
        </label>
        <input
          id="phone"
          type="tel"
          required
          autoComplete="tel"
          value={phone}
          onChange={(e) => handlePhoneInputChange(e.target.value)}
          className="mt-1.5 w-full max-w-md rounded-lg border border-stone-300 px-3 py-2.5 text-stone-900"
          placeholder="(555) 123-4567"
        />
        <SmsConsentCheckbox
          id="checkout-sms-consent"
          checked={smsConsent}
          onChange={setSmsConsent}
          className="mt-2 max-w-md"
        />
      </div>

      {phoneVerified ? (
        <div role="status">
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
            <span aria-hidden="true">✓</span>
            Phone verified
          </p>
          <p className="mt-1 text-sm text-stone-600">
            We&apos;ll text order updates to this number.
          </p>
        </div>
      ) : showOtpPanel ? (
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
          <p className="text-sm font-medium text-stone-900">
            {isSignedIn
              ? "Verify this new phone number to receive order updates."
              : "Verify your phone number to receive order updates."}
          </p>
          <p className="mt-1 text-sm text-stone-600">
            {isSignedIn
              ? "We&apos;ll text you a code to confirm this number."
              : "We&apos;ll text you a code to confirm it&apos;s you."}
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <button
              type="button"
              onClick={handleSendCode}
              disabled={otpSending || !phone.trim() || !smsConsent}
              className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-900 hover:bg-stone-50 disabled:opacity-50"
            >
              {otpSending ? "Sending…" : "Send code"}
            </button>
            <div className="min-w-[8rem] flex-1">
              <label htmlFor="otp-code" className="block text-xs font-medium text-stone-600">
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
                className="mt-1 w-full max-w-[10rem] rounded-lg border border-stone-300 px-3 py-2 text-stone-900 tracking-widest"
                placeholder="000000"
              />
            </div>
            <button
              type="button"
              onClick={handleVerifyCode}
              disabled={otpVerifying || otpCode.length !== 6 || !smsConsent}
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
            >
              {otpVerifying ? "Verifying…" : "Verify"}
            </button>
          </div>
          {otpMessage && (
            <p className="mt-2 text-sm text-stone-600" role="status">
              {otpMessage}
            </p>
          )}
          {otpError && (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {otpError}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
