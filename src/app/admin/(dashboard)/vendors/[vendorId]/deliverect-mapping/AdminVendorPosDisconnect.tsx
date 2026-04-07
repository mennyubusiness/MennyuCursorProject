"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { adminDisconnectVendorFromPos } from "@/actions/admin-vendor-pos.actions";

type Props = {
  vendorId: string;
  vendorName: string;
  hasActivePosConnection: boolean;
};

export function AdminVendorPosDisconnect({ vendorId, vendorName, hasActivePosConnection }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!hasActivePosConnection) {
    return (
      <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600">
        <p className="font-medium text-stone-800">POS / Deliverect connection</p>
        <p className="mt-1">
          No vendor-level Deliverect identifiers are set — already disconnected at the Mennyu integration layer.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50/90 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-950">Admin · Disconnect POS</h2>
      <p className="mt-2 text-sm text-amber-950/90">
        Clears <strong>Deliverect connection fields</strong> on <strong>{vendorName}</strong> so channel / location IDs
        can be reused (e.g. testing). New orders will follow normal Mennyu routing without a live Deliverect channel
        until you connect again.
      </p>
      <p className="mt-2 text-xs text-amber-900/80">
        Does not delete past orders or menu rows. Menu item PLU mappings are unchanged — clean those separately if
        needed.
      </p>

      {error && (
        <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900" role="alert">
          {error}
        </p>
      )}

      {!confirmOpen ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setError(null);
            setConfirmOpen(true);
          }}
          className="mt-4 rounded-lg border border-amber-700 bg-white px-4 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-50"
        >
          Disconnect Deliverect / POS…
        </button>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-medium text-amber-950">Confirm disconnect?</p>
          <p className="text-sm text-amber-900/90">
            This removes channel link, location, and account identifiers from this vendor record and sets POS status to
            not connected.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const r = await adminDisconnectVendorFromPos(vendorId);
                  if (!r.ok) {
                    setError(r.error);
                    return;
                  }
                  setConfirmOpen(false);
                  router.refresh();
                });
              }}
              className="rounded-lg bg-amber-900 px-4 py-2 text-sm font-medium text-white hover:bg-amber-950 disabled:opacity-50"
            >
              {pending ? "Disconnecting…" : "Yes, disconnect"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirmOpen(false)}
              className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm text-stone-800 hover:bg-stone-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
