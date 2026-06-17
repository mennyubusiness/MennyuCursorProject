"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { AccountCheckoutPhone } from "@/lib/account-page-view-model";
import {
  accountHubCardClass,
  accountHubMutedClass,
  accountHubSectionTitleClass,
} from "./account-hub-styles";
import { buttonClassName } from "@/components/ui/button";
import { SmsConsentCheckbox } from "@/components/legal/SmsConsentCheckbox";
import { cn } from "@/lib/cn";
import { normalizePhoneToE164US } from "@/lib/phone-e164";

type AccountPhoneSectionProps = {
  checkoutPhone: AccountCheckoutPhone | null;
};

type CardMode = "readonly" | "edit" | "verify" | "remove_confirm";

function smsStatusLabel(phone: AccountCheckoutPhone): string {
  const parts: string[] = [];
  if (phone.isVerified) parts.push("Verified");
  parts.push(phone.smsUpdatesOn ? "SMS updates on" : "SMS updates off");
  return parts.join(" · ");
}

export function AccountPhoneSection({ checkoutPhone }: AccountPhoneSectionProps) {
  const router = useRouter();
  const [mode, setMode] = useState<CardMode>("readonly");
  const [phone, setPhone] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpMessage, setOtpMessage] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  const linkedPhoneE164 = checkoutPhone?.phoneE164 ?? null;
  const storedSmsConsent = checkoutPhone?.smsUpdatesOn ?? false;
  const hasPhone = Boolean(checkoutPhone?.phoneDisplay);

  useEffect(() => {
    if (mode !== "edit" && mode !== "verify") return;
    if (!linkedPhoneE164) {
      setSmsConsent(false);
      return;
    }
    const normalized = normalizePhoneToE164US(phone);
    if (normalized.ok && normalized.e164 === linkedPhoneE164) {
      setSmsConsent(storedSmsConsent);
    } else if (phone.trim()) {
      setSmsConsent(false);
    }
  }, [phone, linkedPhoneE164, storedSmsConsent, mode]);

  function resetFormState() {
    setPhone("");
    setSmsConsent(false);
    setOtpCode("");
    setOtpMessage(null);
    setOtpError(null);
    setActionError(null);
  }

  function openEdit() {
    resetFormState();
    setMode("edit");
  }

  function cancelEdit() {
    resetFormState();
    setMode("readonly");
  }

  async function handleSendCode() {
    setOtpError(null);
    setOtpMessage(null);
    setActionError(null);
    if (!phone.trim()) {
      setOtpError("Enter your mobile number first.");
      return;
    }
    const normalized = normalizePhoneToE164US(phone);
    if (!normalized.ok) {
      setOtpError(normalized.error);
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
      setMode("verify");
    } catch {
      setOtpError("Could not send code. Try again.");
    } finally {
      setOtpSending(false);
    }
  }

  async function handleVerifyPhone() {
    setOtpError(null);
    setActionError(null);
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
        body: JSON.stringify({ phone, code: otpCode.trim(), smsConsent }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setOtpError(typeof data.error === "string" ? data.error : "Verification failed.");
        return;
      }
      resetFormState();
      setMode("readonly");
      router.refresh();
    } catch {
      setOtpError("Verification failed. Try again.");
    } finally {
      setOtpVerifying(false);
    }
  }

  async function handleRemovePhone() {
    setActionError(null);
    setRemoving(true);
    try {
      const res = await fetch("/api/customer/account/phone/remove", {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setActionError(
          typeof data.error === "string" ? data.error : "Could not remove phone number. Try again."
        );
        return;
      }
      resetFormState();
      setMode("readonly");
      router.refresh();
    } catch {
      setActionError("Could not remove phone number. Try again.");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <section className={accountHubCardClass}>
      <h2 className={accountHubSectionTitleClass}>Phone number</h2>
      <p className={`mt-1 ${accountHubMutedClass}`}>
        Use your phone number for verification and optional order updates. You can also track orders
        from the order status screen after checkout.
      </p>

      {checkoutPhone?.linkStatus === "linked_other" && mode === "readonly" && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {checkoutPhone.phoneDisplay} is linked to another account. Use a different number or sign
          in to that account.
        </p>
      )}

      {checkoutPhone?.linkStatus === "user_has_other" && mode === "readonly" && (
        <p className="mt-3 rounded-lg border border-stone-200 bg-oo-cream px-4 py-3 text-sm text-oo-charcoal">
          This device has a different phone than the one linked to your account (
          {checkoutPhone.phoneDisplay}).
        </p>
      )}

      {mode === "readonly" && !hasPhone && (
        <div className="mt-4">
          <p className="text-sm font-medium text-oo-charcoal">No phone number added</p>
          <p className="mt-1 text-sm text-oo-stone-gray">
            Add a mobile number if you want SMS verification or optional order updates.
          </p>
          {!checkoutPhone?.smsUpdatesOn && (
            <p className="mt-2 text-sm text-oo-stone-gray">
              You can track orders from the order status screen after checkout.
            </p>
          )}
          <button
            type="button"
            onClick={openEdit}
            className={cn(buttonClassName({ variant: "primary", size: "sm" }), "mt-4")}
          >
            Add phone number
          </button>
        </div>
      )}

      {mode === "readonly" && hasPhone && checkoutPhone && (
        <div className="mt-4">
          <p className="text-base font-medium text-oo-charcoal">{checkoutPhone.phoneDisplay}</p>
          <p className="mt-1 text-sm text-oo-stone-gray">{smsStatusLabel(checkoutPhone)}</p>
          {!checkoutPhone.smsUpdatesOn && (
            <p className="mt-2 text-sm text-oo-stone-gray">
              You can track orders from the order status screen after checkout.
            </p>
          )}
          {checkoutPhone.canLink && (
            <p className="mt-2 text-sm text-oo-stone-gray">
              Verify this number to link checkout orders to your account.
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openEdit}
              className={cn(buttonClassName({ variant: "secondary", size: "sm" }))}
            >
              Change
            </button>
            <button
              type="button"
              onClick={() => {
                resetFormState();
                setMode("remove_confirm");
              }}
              className={cn(buttonClassName({ variant: "secondary", size: "sm" }))}
            >
              Remove
            </button>
          </div>
        </div>
      )}

      {mode === "edit" && (
        <div className="mt-4 space-y-4">
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
              placeholder="Enter mobile number"
            />
            <SmsConsentCheckbox
              id="account-sms-consent"
              layout="account"
              checked={smsConsent}
              onChange={setSmsConsent}
              className="mt-3 max-w-md"
            />
            {!smsConsent ? (
              <p className="mt-2 text-sm text-oo-stone-gray" role="status">
                SMS order updates are optional. Check the box above to verify your number and enable
                transactional texts. You can track orders on the order status page without SMS.
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleSendCode()}
              disabled={otpSending || !phone.trim() || !smsConsent}
              className={cn(buttonClassName({ variant: "primary", size: "sm" }))}
            >
              {otpSending ? "Sending…" : "Send verification code"}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              className={cn(buttonClassName({ variant: "secondary", size: "sm" }))}
            >
              Cancel
            </button>
          </div>
          {otpError && (
            <p className="text-sm text-red-600" role="alert">
              {otpError}
            </p>
          )}
        </div>
      )}

      {mode === "verify" && (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-oo-charcoal">
            Verifying <span className="font-medium">{phone.trim() || checkoutPhone?.phoneDisplay}</span>
          </p>
          <div>
            <label htmlFor="account-otp" className="oo-label">
              Verification code
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
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleVerifyPhone()}
              disabled={otpVerifying || otpCode.length !== 6}
              className={cn(buttonClassName({ variant: "primary", size: "sm" }))}
            >
              {otpVerifying ? "Verifying…" : "Verify phone"}
            </button>
            <button
              type="button"
              onClick={() => void handleSendCode()}
              disabled={otpSending}
              className={cn(buttonClassName({ variant: "secondary", size: "sm" }))}
            >
              {otpSending ? "Sending…" : "Resend code"}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              className={cn(buttonClassName({ variant: "secondary", size: "sm" }))}
            >
              Cancel
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
        </div>
      )}

      {mode === "remove_confirm" && (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-oo-charcoal">
            Remove this phone number from your account? You will not receive SMS order updates, but
            you can still track orders from the order status screen.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleRemovePhone()}
              disabled={removing}
              className={cn(buttonClassName({ variant: "primary", size: "sm" }))}
            >
              {removing ? "Removing…" : "Remove phone number"}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={removing}
              className={cn(buttonClassName({ variant: "secondary", size: "sm" }))}
            >
              Cancel
            </button>
          </div>
          {actionError && (
            <p className="text-sm text-red-600" role="alert">
              {actionError}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
