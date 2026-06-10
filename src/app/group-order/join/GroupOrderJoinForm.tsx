"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { joinGroupOrderFormAction } from "@/actions/group-order.actions";
import { SmsConsentCheckbox } from "@/components/legal/SmsConsentCheckbox";

function JoinSubmitButton({ disabled = false }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      className="w-full rounded-xl bg-stone-900 py-3 text-sm font-semibold text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Joining…" : "Join & continue"}
    </button>
  );
}

type Props = {
  groupOrderSessionId: string;
};

export function GroupOrderJoinForm({ groupOrderSessionId }: Props) {
  const joinAttemptKeyRef = useRef<string>(
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `join_${Date.now()}_${Math.random().toString(36).slice(2)}`
  );
  const submitGuardRef = useRef(false);
  const [smsConsent, setSmsConsent] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (submitGuardRef.current) {
      e.preventDefault();
      return;
    }
    if (!smsConsent) {
      e.preventDefault();
      setConsentError("Agree to transactional SMS messages before joining the group order.");
      submitGuardRef.current = false;
      return;
    }
    setConsentError(null);
    submitGuardRef.current = true;
  }

  return (
    <form action={joinGroupOrderFormAction} className="mt-6 space-y-4" onSubmit={onSubmit}>
      <input type="hidden" name="groupOrderSessionId" value={groupOrderSessionId} />
      <input type="hidden" name="joinAttemptKey" value={joinAttemptKeyRef.current} />
      <div>
        <label htmlFor="displayName" className="block text-sm font-medium text-stone-800">
          Display name
        </label>
        <input
          id="displayName"
          name="displayName"
          required
          maxLength={120}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
          placeholder="How you appear in the group cart"
        />
      </div>
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-stone-800">
          Mobile number
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          required
          autoComplete="tel"
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
          placeholder="For order-ready texts (not shown to others)"
        />
        <p className="mt-1 text-xs text-stone-500">
          Used to notify you when your items are ready. Not shared with the host or vendors.
        </p>
        <SmsConsentCheckbox
          id="group-join-sms-consent"
          checked={smsConsent}
          onChange={(checked) => {
            setSmsConsent(checked);
            if (checked) setConsentError(null);
          }}
          className="mt-3"
        />
      </div>
      {consentError ? (
        <p className="text-sm text-red-600" role="alert">
          {consentError}
        </p>
      ) : null}
      <JoinSubmitButton disabled={!smsConsent} />
    </form>
  );
}
