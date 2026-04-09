"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { retryVendorDeliverectConnection } from "@/actions/vendor-pos-retry.actions";

export function VendorPosConnectionRetryButton({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setMsg(null);
          setErr(null);
          startTransition(async () => {
            const r = await retryVendorDeliverectConnection(vendorId);
            if (!r.ok) {
              setErr(r.error);
              return;
            }
            setMsg(r.message);
            router.refresh();
          });
        }}
        className="rounded-lg border border-stone-400 bg-white px-3 py-2 text-sm font-medium text-stone-900 hover:bg-stone-50 disabled:opacity-50"
      >
        {pending ? "Checking…" : "Check connection again"}
      </button>
      {msg ? <p className="mt-2 text-xs text-emerald-800">{msg}</p> : null}
      {err ? (
        <p className="mt-2 text-xs text-amber-900" role="alert">
          {err}
        </p>
      ) : null}
    </div>
  );
}
