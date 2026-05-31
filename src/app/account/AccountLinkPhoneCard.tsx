"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type AccountLinkPhoneCardProps = {
  phoneDisplay: string;
};

export function AccountLinkPhoneCard({ phoneDisplay }: AccountLinkPhoneCardProps) {
  const router = useRouter();
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function linkPhoneToAccount() {
    setLinking(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/customer/account/link", {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
      };

      if (!res.ok || !data.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : "Could not link phone to account. Try again."
        );
        return;
      }

      setSuccess(
        typeof data.message === "string"
          ? data.message
          : "Phone linked to your account."
      );
      router.refresh();
    } catch {
      setError("Could not link phone to account. Try again.");
    } finally {
      setLinking(false);
    }
  }

  return (
    <div className="rounded-lg border border-brand/20 bg-brand/5 p-4">
      <p className="text-sm font-medium text-oo-charcoal">
        Link {phoneDisplay} to this account
      </p>
      <p className="mt-1 text-sm text-oo-stone-gray">
        Orders placed with this phone on this device can appear in your order history.
      </p>
      <div className="mt-3">
        <button
          type="button"
          onClick={() => void linkPhoneToAccount()}
          disabled={linking || Boolean(success)}
          className={cn(buttonClassName({ variant: "primary", size: "sm" }), "w-full sm:w-auto")}
        >
          {linking ? "Linking…" : "Link phone to account"}
        </button>
      </div>
      {success && (
        <p className="mt-3 text-sm font-medium text-emerald-700" role="status">
          {success}
        </p>
      )}
      {error && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
