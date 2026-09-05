"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AdminPodOwnershipFilter } from "@/services/admin-pod-detail.service";

const OWNERSHIP_FILTER_OPTIONS: { value: "" | AdminPodOwnershipFilter; label: string }[] = [
  { value: "", label: "All" },
  { value: "claimed", label: "Claimed" },
  { value: "unclaimed", label: "Unclaimed" },
];

function buildAdminPodsHref(query: string, ownership: "" | AdminPodOwnershipFilter): string {
  const params = new URLSearchParams();
  const q = query.trim();
  if (q) params.set("q", q);
  if (ownership) params.set("ownership", ownership);
  const qs = params.toString();
  return qs ? `/admin/pods?${qs}` : "/admin/pods";
}

export function AdminPodSearchForm({
  initialQuery,
  initialOwnership,
}: {
  initialQuery: string;
  initialOwnership: "" | AdminPodOwnershipFilter;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [ownership, setOwnership] = useState<"" | AdminPodOwnershipFilter>(initialOwnership);

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(buildAdminPodsHref(query, ownership));
      }}
    >
      <div className="min-w-[280px] flex-1">
        <label htmlFor="admin-pod-search" className="sr-only">
          Search pods
        </label>
        <input
          id="admin-pod-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, slug, id, vendor, owner email, location…"
          className="w-full rounded-lg border border-oo-light-stone bg-oo-warm-white px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="admin-pod-ownership" className="mb-1 block text-xs font-medium text-oo-stone-gray">
          Ownership
        </label>
        <select
          id="admin-pod-ownership"
          value={ownership}
          onChange={(e) => {
            const next = e.target.value as "" | AdminPodOwnershipFilter;
            setOwnership(next);
            router.push(buildAdminPodsHref(query, next));
          }}
          className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-2 py-2 text-sm text-oo-charcoal"
        >
          {OWNERSHIP_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value || "all"} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover">
        Search
      </button>
    </form>
  );
}
