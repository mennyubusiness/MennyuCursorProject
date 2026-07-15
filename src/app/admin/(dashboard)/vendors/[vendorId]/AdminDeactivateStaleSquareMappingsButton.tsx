"use client";

import { useState, useTransition } from "react";
import { adminDeactivateSquareMappingsOutsideSelectedLocationAction } from "@/actions/admin-square-mapping.actions";

export function AdminDeactivateStaleSquareMappingsButton({ vendorId }: { vendorId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="mt-4 space-y-2">
      <button
        type="button"
        disabled={pending}
        className="inline-flex items-center justify-center rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-60"
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            const result = await adminDeactivateSquareMappingsOutsideSelectedLocationAction(vendorId);
            if (!result.ok) {
              setMessage(result.error);
              return;
            }
            setMessage(`Deactivated ${result.deactivated} mapping(s) outside the selected location.`);
          });
        }}
      >
        {pending ? "Deactivating…" : "Deactivate mappings outside selected location"}
      </button>
      {message ? <p className="text-xs text-oo-stone-gray">{message}</p> : null}
    </div>
  );
}
