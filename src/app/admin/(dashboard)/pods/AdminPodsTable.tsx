"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AdminPodToggle } from "./AdminPodToggle";

export type AdminPodListRow = {
  id: string;
  name: string;
  vendorCount: number;
  /** Comma-separated vendor names for title tooltip */
  vendorNamesForTooltip: string;
  isActive: boolean;
  ordersToday: number;
  lastOrderAtIso: string | null;
};

function formatLastOrder(iso: string | null): string {
  if (!iso) return "No orders yet";
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const m = Math.floor(diffMs / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 14) return `${days}d ago`;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(d);
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

export function AdminPodsTable({ rows }: { rows: AdminPodListRow[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "paused">("all");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status === "active" && !r.isActive) return false;
      if (status === "paused" && r.isActive) return false;
      if (!term) return true;
      return r.name.toLowerCase().includes(term) || r.id.toLowerCase().includes(term);
    });
  }, [rows, q, status]);

  return (
    <div className="mt-8 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-[200px] flex-1 sm:max-w-md">
          <label htmlFor="pod-search" className="sr-only">
            Search pods
          </label>
          <input
            id="pod-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search pods…"
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-400"
          />
        </div>
        <div>
          <label htmlFor="pod-status-filter" className="mb-1 block text-xs font-medium text-stone-500">
            Status
          </label>
          <select
            id="pod-status-filter"
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

      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50 text-left">
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-stone-500">Pod</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-stone-500">Status</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-stone-500">Vendors</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-stone-500">Activity</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-stone-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-stone-600">
                  No pods match your filters.
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr
                  key={p.id}
                  role="link"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(`/admin/pods/${p.id}`);
                    }
                  }}
                  onClick={() => router.push(`/admin/pods/${p.id}`)}
                  className="cursor-pointer border-b border-stone-100 transition-colors last:border-b-0 hover:bg-stone-50/90"
                >
                  <td className="px-4 py-4 align-top">
                    <span className="font-medium text-stone-900">{p.name}</span>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <StatusPill isActive={p.isActive} />
                  </td>
                  <td className="px-4 py-4 align-top text-stone-800">
                    {p.vendorCount === 0 ? (
                      <span className="text-stone-500">0 vendors</span>
                    ) : (
                      <span
                        title={p.vendorNamesForTooltip}
                        className="inline-flex cursor-help items-baseline gap-1 border-b border-dotted border-stone-400"
                      >
                        <span className="font-medium tabular-nums">{p.vendorCount}</span>
                        <span className="text-stone-600">vendor{p.vendorCount === 1 ? "" : "s"}</span>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 align-top text-stone-700">
                    <div className="text-sm">
                      <span className="font-medium tabular-nums">{p.ordersToday}</span>
                      <span className="text-stone-500"> today</span>
                    </div>
                    <p className="mt-0.5 text-xs text-stone-500">Last order: {formatLastOrder(p.lastOrderAtIso)}</p>
                  </td>
                  <td className="px-4 py-4 align-top text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Link
                        href={`/admin/pods/${p.id}`}
                        className="rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-800"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Manage
                      </Link>
                      <Link
                        href={`/admin/pods/${p.id}/qr`}
                        className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-800 hover:bg-stone-50"
                        onClick={(e) => e.stopPropagation()}
                      >
                        QR
                      </Link>
                      <AdminPodToggle podId={p.id} isActive={p.isActive} variant="compact" />
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
