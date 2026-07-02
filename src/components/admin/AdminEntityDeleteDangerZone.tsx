"use client";

import { useState, useTransition } from "react";

import { AdminActionMessage, AdminInfoRow, AdminSection } from "@/components/admin/AdminReasonActionForm";

export type AdminDeleteSubmitResult =
  | { ok: true; message?: string }
  | { ok: false; error: string; blockers?: string[] };

type AdminEntityDeleteDangerZoneProps = {
  title: string;
  description: string;
  confirmLabel: string;
  confirmationAlternatives: string[];
  deletedAt: string | null;
  deletedByEmail?: string | null;
  requireActiveVendorAck?: boolean;
  activeVendorCount?: number;
  onSubmit: (input: {
    reason: string;
    acknowledgeActiveVendors?: boolean;
  }) => Promise<AdminDeleteSubmitResult>;
};

function matchesConfirmation(value: string, alternatives: string[]): boolean {
  const normalized = value.trim().toUpperCase();
  return alternatives.some((alt) => normalized === alt.trim().toUpperCase());
}

export function AdminEntityDeleteDangerZone({
  title,
  description,
  confirmLabel,
  confirmationAlternatives,
  deletedAt,
  deletedByEmail,
  requireActiveVendorAck = false,
  activeVendorCount = 0,
  onSubmit,
}: AdminEntityDeleteDangerZoneProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [ackVendors, setAckVendors] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const isDeleted = Boolean(deletedAt);
  const confirmHint =
    confirmationAlternatives.length === 1
      ? confirmationAlternatives[0]
      : confirmationAlternatives.map((alt) => `"${alt}"`).join(" or ");

  const canSubmit =
    reason.trim().length >= 3 &&
    matchesConfirmation(confirmation, confirmationAlternatives) &&
    (!requireActiveVendorAck || activeVendorCount === 0 || ackVendors);

  return (
    <AdminSection title="Danger zone">
      {isDeleted ? (
        <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          <p className="font-semibold">Deleted / Deactivated</p>
          <AdminInfoRow label="Deleted at" value={new Date(deletedAt!).toLocaleString()} />
          {deletedByEmail ? <AdminInfoRow label="Deleted by" value={deletedByEmail} /> : null}
        </div>
      ) : (
        <div className="rounded-lg border border-red-200 bg-red-50/40 px-3 py-2">
          <p className="text-sm font-medium text-oo-charcoal">{title}</p>
          <p className="mt-1 text-xs text-oo-stone-gray">{description}</p>
          {!open ? (
            <button
              type="button"
              onClick={() => {
                setOpen(true);
                setMessage(null);
                setError(null);
                setBlockers([]);
              }}
              className="mt-2 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
            >
              {confirmLabel}
            </button>
          ) : (
            <form
              className="mt-3 space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                setMessage(null);
                setError(null);
                setBlockers([]);
                startTransition(async () => {
                  const result = await onSubmit({
                    reason,
                    acknowledgeActiveVendors: requireActiveVendorAck ? ackVendors : undefined,
                  });
                  if (result.ok) {
                    setMessage(result.message ?? "Deleted.");
                    setOpen(false);
                    setReason("");
                    setConfirmation("");
                    setAckVendors(false);
                  } else {
                    setError(result.error);
                    if (result.blockers?.length) setBlockers(result.blockers);
                  }
                });
              }}
            >
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Admin reason (required, min 3 characters)"
                rows={2}
                className="w-full rounded-lg border border-oo-light-stone px-3 py-2 text-sm"
                required
                minLength={3}
              />
              <p className="text-xs text-oo-stone-gray">
                Type {confirmHint} to confirm.
              </p>
              {requireActiveVendorAck && activeVendorCount > 0 ? (
                <label className="flex items-start gap-2 text-xs text-oo-charcoal">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={ackVendors}
                    onChange={(e) => setAckVendors(e.target.checked)}
                  />
                  <span>
                    I understand this pod still has {activeVendorCount} active vendor
                    {activeVendorCount === 1 ? "" : "s"} and they will be removed from public
                    ordering through this pod.
                  </span>
                </label>
              ) : null}
              <input
                type="text"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder={confirmationAlternatives[0] ?? "DELETE"}
                className="w-full max-w-xs rounded-lg border border-oo-light-stone px-3 py-2 text-sm"
                autoComplete="off"
                aria-label="Deletion confirmation"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={pending || !canSubmit}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pending ? "Working…" : confirmLabel}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-oo-light-stone px-3 py-1.5 text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
          <AdminActionMessage message={message} error={error} />
          {blockers.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-800">
              {blockers.map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </AdminSection>
  );
}
