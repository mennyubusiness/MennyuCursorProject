"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { AccountCheckoutPhone } from "@/lib/account-page-view-model";
import { AccountLinkPhoneCard } from "./AccountLinkPhoneCard";
import {
  accountHubCardClass,
  accountHubMutedClass,
  accountHubSectionTitleClass,
} from "./account-hub-styles";
import { buttonClassName } from "@/components/ui/button";
import { SmsConsentNotice } from "@/components/legal/SmsConsentNotice";
import { cn } from "@/lib/cn";

type AccountPhoneSectionProps = {
  checkoutPhone: AccountCheckoutPhone | null;
};

export function AccountPhoneSection({ checkoutPhone }: AccountPhoneSectionProps) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpMessage, setOtpMessage] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  const showAddPhone = checkoutPhone === null;

  async function linkVerifiedPhoneToAccount() {
    const res = await fetch("/api/customer/account/link", {
      method: "POST",
      credentials: "include",
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) {
      setLinkError(
        typeof data.error === "string" ? data.error : "Could not link phone to your account."
      );
      return false;
    }
    router.refresh();
    return true;
  }

  async function handleSendCode() {
    setOtpError(null);
    setOtpMessage(null);
    setLinkError(null);
    if (!phone.trim()) {
      setOtpError("Enter your mobile number first.");
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

  async function handleVerifyAndLink() {
    setOtpError(null);
    setLinkError(null);
    if (!phone.trim() || otpCode.length !== 6) {
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
      const linked = await linkVerifiedPhoneToAccount();
      if (linked) {
        setOtpCode("");
        setOtpMessage("Phone verified and linked to your account.");
      }
    } catch {
      setOtpError("Verification failed. Try again.");
    } finally {
      setOtpVerifying(false);
    }
  }

  return (
    <section className={accountHubCardClass}>
      <h2 className={accountHubSectionTitleClass}>Phone for order updates</h2>
      <p className={`mt-1 ${accountHubMutedClass}`}>
        Used for checkout and SMS order updates — separate from your email sign-in.
      </p>

      {checkoutPhone?.linkStatus === "linked" && (
        <div className="mt-4 rounded-lg border border-emerald-200/80 bg-emerald-50/80 px-4 py-3">
          <p className="text-sm font-medium text-emerald-900">{checkoutPhone.phoneDisplay}</p>
          <p className="mt-0.5 text-xs text-emerald-800">{checkoutPhone.linkStatusLabel}</p>
        </div>
      )}

      {checkoutPhone?.linkStatus === "linked_other" && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">{checkoutPhone.phoneDisplay}</p>
          <p className="mt-1">This phone is already linked to another account.</p>
        </div>
      )}

      {checkoutPhone?.linkStatus === "user_has_other" && (
        <div className="mt-4 rounded-lg border border-stone-200 bg-oo-cream px-4 py-3 text-sm text-oo-charcoal">
          <p className="font-medium">{checkoutPhone.phoneDisplay}</p>
          <p className="mt-1">Your account already has a different phone linked.</p>
        </div>
      )}

      {checkoutPhone?.canLink && (
        <div className="mt-4">
          <AccountLinkPhoneCard phoneDisplay={checkoutPhone.phoneDisplay} />
        </div>
      )}

      {showAddPhone && (
        <div className="mt-4 rounded-lg border border-oo-light-stone bg-oo-cream/80 p-4">
          <p className="text-sm font-medium text-oo-charcoal">Add phone for order updates</p>
          <p className="mt-1 text-sm text-oo-stone-gray">
            Verify your mobile number to receive order texts and link phone checkout orders to this
            account.
          </p>
          <div className="mt-4 space-y-3">
            <div>
              <label htmlFor="account-phone" className="oo-label">
                Mobile number
              </label>
              <input
                id="account-phone"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="oo-input mt-1 max-w-md"
                placeholder="(555) 123-4567"
              />
              <SmsConsentNotice className="mt-2 max-w-md" />
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <button
                type="button"
                onClick={() => void handleSendCode()}
                disabled={otpSending || !phone.trim()}
                className={cn(buttonClassName({ variant: "secondary", size: "sm" }))}
              >
                {otpSending ? "Sending…" : "Send code"}
              </button>
              <div>
                <label htmlFor="account-otp" className="block text-xs font-medium text-oo-stone-gray">
                  6-digit code
                </label>
                <input
                  id="account-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="oo-input mt-1 w-32 tracking-widest"
                  placeholder="000000"
                />
              </div>
              <button
                type="button"
                onClick={() => void handleVerifyAndLink()}
                disabled={otpVerifying || otpCode.length !== 6}
                className={cn(buttonClassName({ variant: "primary", size: "sm" }))}
              >
                {otpVerifying ? "Verifying…" : "Verify & link"}
              </button>
            </div>
            {otpMessage && (
              <p className="text-sm text-oo-stone-gray" role="status">
                {otpMessage}
              </p>
            )}
            {otpError && (
              <p className="text-sm text-red-600" role="alert">
                {otpError}
              </p>
            )}
            {linkError && (
              <p className="text-sm text-red-600" role="alert">
                {linkError}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}