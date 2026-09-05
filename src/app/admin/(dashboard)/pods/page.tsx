import Link from "next/link";
import {
  parseAdminPodOwnershipQuery,
  searchAdminPods,
} from "@/services/admin-pod-detail.service";
import { AdminCreateUnclaimedPodForm } from "./AdminCreateUnclaimedPodForm";
import { AdminPodSearchForm } from "./AdminPodSearchForm";

export default async function AdminPodsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; ownership?: string }>;
}) {
  const sp = await searchParams;
  const query = sp.q?.trim() ?? "";
  const ownership = parseAdminPodOwnershipQuery(sp.ownership);
  const hasFilter = Boolean(query || ownership);
  const results = hasFilter
    ? await searchAdminPods(query, { ownership })
    : [];

  const emptyMessage = query
    ? `No pods matched “${query}”${ownership ? ` that are ${ownership}` : ""}.`
    : ownership
      ? `No ${ownership} pods were found.`
      : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-oo-charcoal">Pods</h1>
        <p className="mt-1 max-w-3xl text-sm text-oo-stone-gray">
          Search pods for launch support. Open a row for rescue tools: pause/hide, profile repair, vendor roster, QR
          status, invites, and audit history.
        </p>
      </div>

      <AdminCreateUnclaimedPodForm />

      <AdminPodSearchForm
        key={`${query}|${ownership ?? "all"}`}
        initialQuery={query}
        initialOwnership={ownership ?? ""}
      />

      {hasFilter ? (
        <div className="overflow-x-auto rounded-xl border border-oo-light-stone bg-oo-warm-white">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-oo-light-stone text-oo-stone-gray">
                <th className="px-4 py-3 font-medium">Pod</th>
                <th className="px-4 py-3 font-medium">State</th>
                <th className="px-4 py-3 font-medium">Vendors</th>
                <th className="px-4 py-3 font-medium">Owners</th>
                <th className="px-4 py-3 font-medium">Readiness</th>
              </tr>
            </thead>
            <tbody>
              {results.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-oo-stone-gray">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                results.map((row) => (
                  <tr key={row.id} className="border-b border-oo-light-stone/70 last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/admin/pods/${row.id}`} className="font-medium underline">
                        {row.name}
                      </Link>
                      <p className="font-mono text-xs text-oo-stone-gray">{row.slug}</p>
                      <p className="text-xs text-oo-stone-gray">{row.publicPath}</p>
                      {row.address ? <p className="text-xs text-oo-stone-gray">{row.address}</p> : null}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {!row.isActive ? "Hidden" : row.mennyuOrdersPaused ? "Ordering paused" : "Public"}
                    </td>
                    <td className="px-4 py-3 text-xs text-oo-stone-gray">
                      {row.orderableVendorCount}/{row.vendorCount} orderable
                    </td>
                    <td className="px-4 py-3 text-xs text-oo-stone-gray">
                      {row.ownerEmails.length > 0
                        ? `Claimed · ${row.ownerEmails.join(", ")}`
                        : "Unclaimed"}
                    </td>
                    <td className="px-4 py-3 text-xs text-oo-stone-gray">{row.readinessLabel}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {results.length > 0 ? (
            <p className="border-t border-oo-light-stone px-4 py-2 text-xs text-oo-stone-gray">
              Showing {results.length} pod{results.length === 1 ? "" : "s"}
              {ownership ? ` · ${ownership === "claimed" ? "Claimed" : "Unclaimed"}` : ""}
              {query ? ` · matching “${query}”` : ""}.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-oo-stone-gray">
          Enter a search term, or choose Claimed / Unclaimed to list pods by ownership.
        </p>
      )}
    </div>
  );
}
