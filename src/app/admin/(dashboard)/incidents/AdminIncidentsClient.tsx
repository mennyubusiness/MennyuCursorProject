"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import type { AdminIncidentRow, AdminIncidentSeverity, AdminIncidentType } from "@/lib/admin-incident-types";
import {
  INCIDENT_SEVERITY_OPTIONS,
  INCIDENT_TYPE_OPTIONS,
} from "@/lib/admin-incident-types";

function severityBadge(severity: AdminIncidentRow["severity"]) {
  const cls =
    severity === "critical"
      ? "bg-red-100 text-red-900"
      : severity === "warning"
        ? "bg-amber-100 text-amber-950"
        : "bg-slate-100 text-slate-800";
  return (
    <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium uppercase ${cls}`}>
      {severity}
    </span>
  );
}

export function AdminIncidentsClient({
  rows,
  total,
  page,
  pageSize,
}: {
  rows: AdminIncidentRow[];
  total: number;
  page: number;
  pageSize: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === "all" || !value) params.delete(key);
      else params.set(key, value);
      params.delete("page");
      router.push(`/admin/incidents?${params.toString()}`);
    },
    [router, searchParams]
  );

  const severity = searchParams.get("severity") ?? "all";
  const type = searchParams.get("type") ?? "all";

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-xs text-oo-stone-gray">
          Severity
          <select
            className="rounded border border-oo-light-stone bg-oo-warm-white px-2 py-1.5 text-sm text-oo-charcoal"
            value={severity}
            onChange={(e) => setFilter("severity", e.target.value)}
          >
            {INCIDENT_SEVERITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-oo-stone-gray">
          Type
          <select
            className="rounded border border-oo-light-stone bg-oo-warm-white px-2 py-1.5 text-sm text-oo-charcoal"
            value={type}
            onChange={(e) => setFilter("type", e.target.value)}
          >
            {INCIDENT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-oo-light-stone bg-oo-cream/50 px-6 py-10 text-center">
          <p className="font-medium text-oo-charcoal">No incidents match these filters</p>
          <p className="mt-1 text-sm text-oo-stone-gray">
            Try broadening filters or check{" "}
            <Link href="/admin/exceptions" className="underline">
              Issues
            </Link>{" "}
            for the full attention workbench.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-oo-light-stone">
          <table className="min-w-full divide-y divide-oo-light-stone text-sm">
            <thead className="bg-oo-cream/80 text-left text-xs uppercase tracking-wide text-oo-stone-gray">
              <tr>
                <th className="px-3 py-2">Severity</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Entity</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Detected</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-oo-light-stone bg-oo-warm-white">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2">{severityBadge(row.severity)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.type}</td>
                  <td className="px-3 py-2">
                    <span className="text-xs text-oo-stone-gray">{row.entityType}</span>
                    <br />
                    {row.entityLabel}
                  </td>
                  <td className="px-3 py-2 max-w-md">
                    <p className="font-medium text-oo-charcoal">{row.description}</p>
                    <p className="mt-0.5 text-xs text-oo-stone-gray">{row.reasonDetail}</p>
                    <p className="mt-1 text-xs text-oo-stone-gray">
                      State: {row.currentState} · {row.recommendedAction}
                    </p>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-oo-stone-gray">
                    {row.detectedAt.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-xs">{row.recommendedAction}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={row.adminHref}
                      className="font-medium text-brand hover:underline"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center gap-2 text-sm text-oo-stone-gray">
          <span>
            Page {page} of {totalPages} ({total} incidents)
          </span>
          {page > 1 && (
            <Link
              href={`/admin/incidents?${new URLSearchParams({ ...Object.fromEntries(searchParams), page: String(page - 1) }).toString()}`}
              className="underline"
            >
              Previous
            </Link>
          )}
          {page < totalPages && (
            <Link
              href={`/admin/incidents?${new URLSearchParams({ ...Object.fromEntries(searchParams), page: String(page + 1) }).toString()}`}
              className="underline"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
