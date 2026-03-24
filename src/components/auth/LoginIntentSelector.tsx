"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { resolveLoginIntent, type LoginIntent } from "@/lib/auth/login-intent";

const OPTIONS: { id: LoginIntent; label: string; description: string }[] = [
  {
    id: "vendor",
    label: "Vendor dashboard",
    description: "Orders, menu, and settings for your restaurant.",
  },
  {
    id: "pod",
    label: "Pod dashboard",
    description: "Manage a pod and its vendors (coming soon).",
  },
  {
    id: "customer",
    label: "Your orders (diner)",
    description: "View order history with your checkout phone number. Email sign-in goes to the same place.",
  },
  {
    id: "admin",
    label: "Mennyu team access",
    description: "Internal tools for Mennyu staff.",
  },
];

export function LoginIntentSelector() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const intent = useMemo(() => {
    const raw = searchParams.get("intent");
    const cb = searchParams.get("callbackUrl") ?? "";
    return resolveLoginIntent(raw, cb);
  }, [searchParams]);

  const setIntent = useCallback(
    (next: LoginIntent) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("intent", next);
      const q = params.toString();
      router.replace(q ? `/login?${q}` : "/login", { scroll: false });
    },
    [router, searchParams]
  );

  return (
    <div className="space-y-3">
      <p className="text-center text-sm font-medium text-stone-700">Sign in to</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {OPTIONS.map((opt) => {
          const selected = intent === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setIntent(opt.id)}
              className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                selected
                  ? "border-mennyu-primary bg-mennyu-primary/5 ring-1 ring-mennyu-primary"
                  : "border-stone-200 bg-white hover:border-stone-300"
              }`}
            >
              <span className="font-semibold text-stone-900">{opt.label}</span>
              <span className="mt-1 block text-xs text-stone-600">{opt.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
