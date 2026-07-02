"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { DashboardCard } from "@/components/dashboard";

type EntityDeleteDangerZoneProps = {
  title: string;
  description: string;
  entityLabel: string;
  deleteUrl: string;
  redirectTo: string;
  extraFields?: Record<string, boolean>;
  requireActiveVendorAck?: boolean;
  activeVendorCount?: number;
};

export function EntityDeleteDangerZone({
  title,
  description,
  entityLabel,
  deleteUrl,
  redirectTo,
  extraFields,
  requireActiveVendorAck = false,
  activeVendorCount = 0,
}: EntityDeleteDangerZoneProps) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [ackVendors, setAckVendors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<string[]>([]);

  async function handleDelete() {
    setError(null);
    setBlockers([]);
    setSubmitting(true);
    try {
      const response = await fetch(deleteUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmation,
          acknowledgeActiveVendors: requireActiveVendorAck ? ackVendors : undefined,
          ...extraFields,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        blockers?: string[];
        redirectTo?: string;
      };
      if (!response.ok) {
        setError(data.error ?? "Deletion failed.");
        if (data.blockers?.length) setBlockers(data.blockers);
        return;
      }
      router.push(data.redirectTo ?? redirectTo);
      router.refresh();
    } catch {
      setError("Deletion failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    confirmation.trim().toUpperCase() === "DELETE" &&
    (!requireActiveVendorAck || activeVendorCount === 0 || ackVendors);

  return (
    <DashboardCard
      title={title}
      description={description}
      className="border-status-error/30"
    >
      <div className="space-y-4">
        <p className="text-sm text-oo-stone-gray">
          Type <span className="font-mono font-semibold text-oo-charcoal">DELETE</span> to confirm
          deletion of <span className="font-semibold text-oo-charcoal">{entityLabel}</span>.
        </p>
        {requireActiveVendorAck && activeVendorCount > 0 ? (
          <label className="flex items-start gap-3 text-sm text-oo-charcoal">
            <input
              type="checkbox"
              className="mt-1"
              checked={ackVendors}
              onChange={(event) => setAckVendors(event.target.checked)}
            />
            <span>
              I understand this pod still has {activeVendorCount} active vendor
              {activeVendorCount === 1 ? "" : "s"} and they will be removed from public ordering
              through this pod.
            </span>
          </label>
        ) : null}
        <input
          type="text"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          placeholder="DELETE"
          className="oo-input mt-0 max-w-xs"
          autoComplete="off"
          aria-label="Deletion confirmation"
        />
        {error ? <p className="oo-form-error">{error}</p> : null}
        {blockers.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-status-error">
            {blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        ) : null}
        <button
          type="button"
          disabled={!canSubmit || submitting}
          onClick={() => void handleDelete()}
          className="rounded-lg bg-status-error px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Deleting…" : title}
        </button>
      </div>
    </DashboardCard>
  );
}
