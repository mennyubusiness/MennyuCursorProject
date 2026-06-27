import Link from "next/link";
import { searchAdminPods } from "@/services/admin-pod-detail.service";
import { AdminPodSearchForm } from "./AdminPodSearchForm";

export default async function AdminPodsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const query = sp.q?.trim() ?? "";
  const results = query ? await searchAdminPods(query) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-oo-charcoal">Pods</h1>
        <p className="mt-1 max-w-3xl text-sm text-oo-stone-gray">
          Search pods for launch support. Open a row for rescue tools: pause/hide, profile repair, vendor roster, QR
          status, invites, and audit history.
        </p>
      </div>

      <AdminPodSearchForm initialQuery={query} />

      {query ? (
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
                    No pods matched &ldquo;{query}&rdquo;.
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
                      {row.ownerEmails.length > 0 ? row.ownerEmails.join(", ") : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-oo-stone-gray">{row.readinessLabel}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-oo-stone-gray">Enter a search term to find pods.</p>
      )}
    </div>
  );
}
