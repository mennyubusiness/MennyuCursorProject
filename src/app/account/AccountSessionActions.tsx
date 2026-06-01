"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { CustomerSignOutForm } from "@/components/auth/CustomerSignOutForm";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type AccountSessionActionsProps = {
  hasCheckoutPhoneSession: boolean;
};

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
      <CustomerSignOutForm
        className={cn(buttonClassName({ variant: "secondary", size: "sm" }), "w-full sm:w-auto")}
      />
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
