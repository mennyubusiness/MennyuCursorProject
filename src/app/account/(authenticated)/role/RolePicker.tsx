"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { RegistrationIntent } from "@prisma/client";
import { setRegistrationRole } from "@/actions/account-setup.actions";
import { appendNextQueryParam } from "@/lib/auth/invite-token-path";
import {
  readLoginReturnParam,
  sanitizeLoginReturnPath,
} from "@/lib/auth/login-return-path";
import { DashboardPageHeader } from "@/components/dashboard";

const OPTIONS: {
  id: RegistrationIntent;
  title: string;
  body: string;
}[] = [
  {
    id: RegistrationIntent.customer,
    title: "Customer",
    body: "Order from pods and track your purchases. Quick profile only.",
  },
  {
    id: RegistrationIntent.vendor,
    title: "Vendor",
    body: "Manage your menu, orders, and kitchen settings. You can add integrations later.",
  },
  {
    id: RegistrationIntent.pod_owner,
    title: "Pod owner",
    body: "Run a pickup location with multiple vendors. Start with basic pod details.",
  },
];

export function RolePicker() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState<RegistrationIntent | null>(null);
  const [error, setError] = useState<string | null>(null);

  const returnPathSafe = sanitizeLoginReturnPath(readLoginReturnParam(searchParams));

  async function choose(intent: RegistrationIntent) {
    setError(null);
    setLoading(intent);
    try {
      const r = await setRegistrationRole(intent);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      if (r.nextPath) {
        const dest =
          returnPathSafe != null ? appendNextQueryParam(r.nextPath, returnPathSafe) : r.nextPath;
        router.push(dest);
        router.refresh();
      }
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        headingLevel={1}
        title="How will you use Open Order?"
        description="You can add other roles later as we expand accounts — pick what fits you now."
      />
      <div className="space-y-3">
        {OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            disabled={loading !== null}
            onClick={() => void choose(opt.id)}
            className="w-full rounded-xl border border-oo-light-stone bg-oo-warm-white p-4 text-left text-sm shadow-sm transition hover:border-brand/30 hover:bg-oo-cream/60 disabled:opacity-60"
          >
            <span className="font-semibold text-oo-charcoal">{opt.title}</span>
            <span className="mt-1 block text-oo-stone-gray">{opt.body}</span>
            {loading === opt.id ? (
              <span className="mt-2 block text-xs text-oo-stone-gray">Loading…</span>
            ) : null}
          </button>
        ))}
      </div>
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
