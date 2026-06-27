"use client";

import { useState, useTransition } from "react";

export function AdminActionMessage({ message, error }: { message: string | null; error: string | null }) {
  if (error) {
    return <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>;
  }
  if (message) {
    return (
      <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{message}</p>
    );
  }
  return null;
}

export function AdminSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-oo-stone-gray">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

export function AdminInfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-2 text-sm">
      <span className="text-oo-stone-gray">{label}:</span>
      <span className="text-oo-charcoal">{value}</span>
    </div>
  );
}

export function AdminReasonActionForm({
  label,
  description,
  confirmLabel,
  danger,
  disabled,
  disabledReason,
  onSubmit,
}: {
  label: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onSubmit: (reason: string) => Promise<{ ok: boolean; message?: string; error?: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (disabled) {
    return (
      <div className="rounded-lg border border-dashed border-oo-light-stone px-3 py-2 text-sm text-oo-stone-gray">
        <p className="font-medium text-oo-charcoal">{label}</p>
        <p className="mt-1">{disabledReason ?? "Not available."}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-oo-light-stone px-3 py-2">
      <p className="text-sm font-medium text-oo-charcoal">{label}</p>
      <p className="mt-1 text-xs text-oo-stone-gray">{description}</p>
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setMessage(null);
            setError(null);
          }}
          className={`mt-2 rounded-lg px-3 py-1.5 text-sm font-medium ${
            danger
              ? "bg-red-600 text-white hover:bg-red-700"
              : "border border-oo-light-stone bg-white text-oo-charcoal hover:bg-oo-light-stone/30"
          }`}
        >
          {confirmLabel}
        </button>
      ) : (
        <form
          className="mt-2 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            setMessage(null);
            setError(null);
            startTransition(async () => {
              const result = await onSubmit(reason);
              if (result.ok) {
                setMessage(result.message ?? "Done.");
                setOpen(false);
                setReason("");
              } else {
                setError(result.error ?? "Action failed.");
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
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={pending}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
                danger ? "bg-red-600 text-white hover:bg-red-700" : "bg-brand text-white hover:bg-brand-hover"
              }`}
            >
              {pending ? "Working…" : "Confirm"}
            </button>
            <button type="button" disabled={pending} onClick={() => setOpen(false)} className="rounded-lg border border-oo-light-stone px-3 py-1.5 text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}
      <AdminActionMessage message={message} error={error} />
    </div>
  );
}
