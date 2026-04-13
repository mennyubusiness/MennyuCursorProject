"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AdminVendorToggle } from "./AdminVendorToggle";

export type AdminVendorListRow = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  pods: { podId: string; podName: string }[];
  ordersAllTime: number;
  ordersLast30Days: number;
  lastActiveAtIso: string | null;
};

const POD_NONE = "__none__";

function formatLastActive(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const m = Math.floor(diffMs / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 14) return `${days}d ago`;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(d);
}

function StatusPill({ isActive }: { isActive: boolean }) {
  if (isActive) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-800">
        <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
        Active
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600">
      <span className="h-2 w-2 rounded-full bg-stone-400" aria-hidden />
      Paused
    </span>
  );
}

export function AdminVendorsTable({
  rows,
  podOptions,
}: {
  rows: AdminVendorListRow[];
  podOptions: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [podId, setPodId] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "paused">("all");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status === "active" && !r.isActive) return false;
      if (status === "paused" && r.isActive) return false;
      if (podId) {
        if (podId === POD_NONE) {
          if (r.pods.length > 0) return false;
        } else if (!r.pods.some((p) => p.podId === podId)) return false;
      }
      if (!term) return true;
      return (
        r.name.toLowerCase().includes(term) ||
        r.slug.toLowerCase().includes(term) ||
        r.id.toLowerCase().includes(term)
      );
    });
  }, [rows, q, podId, status]);

  return (
    <div className="mt-8 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-[200px] flex-1 sm:max-w-md">
          <label htmlFor="vendor-search" className="sr-only">
            Search vendors
          </label>
          <input
            id="vendor-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search vendors…"
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-400"
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <div>
            <label htmlFor="pod-filter" className="mb-1 block text-xs font-medium text-stone-500">
              Pod
            </label>
            <select
              id="pod-filter"
              value={podId}
              onChange={(e) => setPodId(e.target.value)}
              className="rounded-lg border border-stone-300 bg-white px-2 py-2 text-sm text-stone-800"
            >
              <option value="">All pods</option>
              <option value={POD_NONE}>No pod</option>
              {podOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="status-filter" className="mb-1 block text-xs font-medium text-stone-500">
              Status
            </label>
            <select
              id="status-filter"
              value={status}
              onChange={(e) => setStatus(e.target.value as "all" | "active" | "paused")}
              className="rounded-lg border border-stone-300 bg-white px-2 py-2 text-sm text-stone-800"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50 text-left">
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-stone-500">Name</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-stone-500">Status</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-stone-500">Pod</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-stone-500">Orders</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-stone-500">Last active</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-stone-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-stone-600">
                  No vendors match your filters.
                </td>
              </tr>
            ) : (
              filtered.map((v) => (
                <tr
                  key={v.id}
                  role="link"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(`/admin/vendors/${v.id}`);
                    }
                  }}
                  onClick={() => router.push(`/admin/vendors/${v.id}`)}
                  className="cursor-pointer border-b border-stone-100 transition-colors last:border-b-0 hover:bg-stone-50/90"
                >
                  <td className="px-4 py-4 align-top">
                    <span className="font-medium text-stone-900">{v.name}</span>
                    <p className="mt-0.5 font-mono text-xs text-stone-500">{v.slug}</p>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <StatusPill isActive={v.isActive} />
                  </td>
                  <td className="px-4 py-4 align-top text-stone-700" onClick={(e) => e.stopPropagation()}>
                    {v.pods.length === 0 ? (
                      <span className="text-stone-400">—</span>
                    ) : (
                      <span className="flex flex-col gap-1">
                        {v.pods.map((p) => (
                          <Link
                            key={p.podId}
                            href={`/pod/${p.podId}/dashboard`}
                            className="text-sky-800 underline decoration-sky-800/30 underline-offset-2 hover:text-sky-950"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {p.podName}
                          </Link>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 align-top tabular-nums text-stone-800">
                    <span className="font-medium">{v.ordersAllTime.toLocaleString()}</span>
                    <p className="mt-0.5 text-xs text-stone-500">All time · {v.ordersLast30Days.toLocaleString()} last 30d</p>
                  </td>
                  <td className="px-4 py-4 align-top text-stone-600" title={v.lastActiveAtIso ?? undefined}>
                    {formatLastActive(v.lastActiveAtIso)}
                  </td>
                  <td className="px-4 py-4 align-top text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Link
                        href={`/admin/vendors/${v.id}`}
                        className="rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-800"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Manage
                      </Link>
                      <AdminVendorToggle vendorId={v.id} isActive={v.isActive} variant="compact" />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
