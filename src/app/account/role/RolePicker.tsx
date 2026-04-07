"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RegistrationIntent } from "@prisma/client";
import { setRegistrationRole } from "@/actions/account-setup.actions";

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
    title: "Restaurant / vendor",
    body: "Manage your menu, orders, and kitchen settings. You’ll add integrations later.",
  },
  {
    id: RegistrationIntent.pod_owner,
    title: "Pod owner",
    body: "Run a pickup location with multiple vendors. Start with basic pod details.",
  },
];

export function RolePicker() {
  const router = useRouter();
  const [loading, setLoading] = useState<RegistrationIntent | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        router.push(r.nextPath);
        router.refresh();
      }
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">How will you use Mennyu?</h1>
        <p className="mt-1 text-sm text-stone-600">
          You can add other roles later as we expand accounts — pick what fits you now.
        </p>
      </div>
      <div className="space-y-2">
        {OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            disabled={loading !== null}
            onClick={() => void choose(opt.id)}
            className="w-full rounded-lg border border-stone-200 bg-white p-4 text-left text-sm shadow-sm transition hover:border-mennyu-primary hover:bg-mennyu-primary/5 disabled:opacity-60"
          >
            <span className="font-semibold text-stone-900">{opt.title}</span>
            <span className="mt-1 block text-stone-600">{opt.body}</span>
            {loading === opt.id ? (
              <span className="mt-2 block text-xs text-stone-500">Loading…</span>
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
