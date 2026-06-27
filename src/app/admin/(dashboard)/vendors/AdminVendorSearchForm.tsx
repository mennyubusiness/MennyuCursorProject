"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminVendorSearchForm({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  return (
    <form
      className="flex flex-wrap gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const q = query.trim();
        router.push(q ? `/admin/vendors?q=${encodeURIComponent(q)}` : "/admin/vendors");
      }}
    >
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name, slug, id, pod, owner email, Stripe or Deliverect id…"
        className="min-w-[280px] flex-1 rounded-lg border border-oo-light-stone bg-oo-warm-white px-3 py-2 text-sm"
      />
      <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover">
        Search
      </button>
    </form>
  );
}
