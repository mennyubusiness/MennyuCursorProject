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
    <section className="rounded-xl border border-stone-200 bg-stone-50 p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-stone-900">Link checkout phone to this account</h2>
      <p className="mt-2 text-sm text-stone-600">
        Connect {phoneDisplay} so orders placed with this phone can appear in your order history.
      </p>
      <div className="mt-4">
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
    </section>
  );
}
