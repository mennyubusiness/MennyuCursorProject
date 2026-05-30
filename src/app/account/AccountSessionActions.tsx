"use client";

import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type AccountSessionActionsProps = {
  hasCheckoutPhoneSession: boolean;
};

export function AccountSessionActions({ hasCheckoutPhoneSession }: AccountSessionActionsProps) {
  const router = useRouter();
  const [clearingPhone, setClearingPhone] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function clearCheckoutPhoneSession() {
    setClearingPhone(true);
    try {
      await fetch("/api/customer/session/clear", { method: "POST", credentials: "include" });
      router.refresh();
    } finally {
      setClearingPhone(false);
    }
  }

  async function signOutAccount() {
    setSigningOut(true);
    try {
      await signOut({ callbackUrl: "/login" });
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => void signOutAccount()}
        disabled={signingOut}
        className={cn(
          buttonClassName({ variant: "secondary", size: "sm" }),
          "w-full sm:w-auto"
        )}
      >
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
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
          <p className="text-xs text-stone-500">
            Removes verified checkout phone from this browser. You stay signed in to your account.
          </p>
        </div>
      )}
    </div>
  );
}
