"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type SearchResult = {
  id: string;
  name: string;
  slug: string;
  contactEmail: string | null;
  inAnotherPod: boolean;
  otherPodName: string | null;
};

const MIN_QUERY_LENGTH = 2;

export function PodDashboardVendorSearch({ podId }: { podId: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [invitingId, setInvitingId] = useState<string | null>(null);

  useEffect(() => {
    if (query.trim().length < MIN_QUERY_LENGTH) {
      setResults([]);
      setError(null);
      return;
    }

    const handle = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        setError(null);
        try {
          const res = await fetch(
            `/api/pod/${podId}/vendor-search?q=${encodeURIComponent(query.trim())}`
          );
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
            results?: SearchResult[];
          };
          if (!res.ok) {
            setResults([]);
            setError(data.error ?? "Search failed.");
            return;
          }
          setResults(data.results ?? []);
        } finally {
          setLoading(false);
        }
      })();
    }, 300);

    return () => window.clearTimeout(handle);
  }, [podId, query]);

  async function inviteVendor(vendor: SearchResult) {
    if (!vendor.contactEmail) {
      setError("This vendor has no contact email on file. Use invite by email instead.");
      return;
    }

    setInvitingId(vendor.id);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/pod/${podId}/vendor-invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invitedEmail: vendor.contactEmail,
          invitedVendorName: vendor.name,
          targetVendorId: vendor.id,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not send invite.");
        return;
      }
      setSuccess(`Invite sent to ${vendor.name}.`);
      setQuery("");
      setResults([]);
      router.refresh();
    } finally {
      setInvitingId(null);
    }
  }

  return (
    <div className="space-y-2">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by vendor name or email"
        className="w-full rounded border border-oo-light-stone px-3 py-2 text-sm text-oo-charcoal focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30"
      />
      {query.trim().length > 0 && query.trim().length < MIN_QUERY_LENGTH ? (
        <p className="text-xs text-oo-stone-gray">Type at least {MIN_QUERY_LENGTH} characters to search.</p>
      ) : null}
      {loading ? <p className="text-xs text-oo-stone-gray">Searching…</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-800">{success}</p> : null}
      {results.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {results.map((vendor) => (
            <li
              key={vendor.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded border border-oo-light-stone bg-oo-warm-white px-3 py-2 text-sm"
            >
              <div>
                <span className="font-medium text-oo-charcoal">{vendor.name}</span>
                {vendor.inAnotherPod ? (
                  <span className="ml-2 text-xs text-amber-800">
                    In {vendor.otherPodName ?? "another pod"} — accepting moves them here
                  </span>
                ) : null}
                {vendor.contactEmail ? (
                  <p className="text-xs text-oo-stone-gray">{vendor.contactEmail}</p>
                ) : (
                  <p className="text-xs text-amber-800">No contact email on file</p>
                )}
              </div>
              <button
                type="button"
                disabled={invitingId === vendor.id || !vendor.contactEmail}
                onClick={() => void inviteVendor(vendor)}
                className="rounded bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-hover disabled:opacity-50"
              >
                {invitingId === vendor.id ? "Sending…" : "Send pod invite"}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {!loading && query.trim().length >= MIN_QUERY_LENGTH && results.length === 0 && !error ? (
        <p className="text-sm text-oo-stone-gray">No vendors found.</p>
      ) : null}
    </div>
  );
}
