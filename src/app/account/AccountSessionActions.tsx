"use client";

import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { useState } from "react";

import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/cn";

import { signOutAccountAction } from "./actions";

type AccountSessionActionsProps = {
  hasCheckoutPhoneSession: boolean;
};

function SignOutSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(buttonClassName({ variant: "secondary", size: "sm" }), "w-full sm:w-auto")}
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}

export function AccountSessionActions({ hasCheckoutPhoneSession }: AccountSessionActionsProps) {
  const router = useRouter();
  const [clearingPhone, setClearingPhone] = useState(false);
  const [clearPhoneError, setClearPhoneError] = useState<string | null>(null);

  async function clearCheckoutPhoneSession() {
    setClearingPhone(true);
    setClearPhoneError(null);
    try {
      const res = await fetch("/api/customer/session/clear", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        setClearPhoneError("Could not clear checkout phone. Please try again.");
        return;
      }
      router.refresh();
    } catch {
      setClearPhoneError("Could not clear checkout phone. Please try again.");
    } finally {
      setClearingPhone(false);
    }
  }

  return (
    <div className="space-y-3">
      <form action={signOutAccountAction}>
        <SignOutSubmitButton />
      </form>
      {hasCheckoutPhoneSession && (
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => void clearCheckoutPhoneSession()}
            disabled={clearingPhone}
            className={cn(
              buttonClassName({ variant: "secondary", size: "sm" }),
              "w-full sm:w-auto"
            )}
          >
            {clearingPhone ? "Clearing…" : "Clear checkout phone on this device"}
          </button>
          {clearPhoneError && (
            <p className="text-xs text-red-700" role="alert">
              {clearPhoneError}
            </p>
          )}
          <p className="text-xs text-stone-500">
            Removes verified checkout phone from this browser. You stay signed in to your account.
          </p>
        </div>
      )}
    </div>
  );
}
