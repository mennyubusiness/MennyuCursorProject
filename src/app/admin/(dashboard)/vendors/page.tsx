import Link from "next/link";
import { searchAdminVendors } from "@/services/admin-vendor-detail.service";
import { AdminVendorSearchForm } from "./AdminVendorSearchForm";

export default async function AdminVendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const query = sp.q?.trim() ?? "";
  const results = query ? await searchAdminVendors(query) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-oo-charcoal">Vendors</h1>
        <p className="mt-1 max-w-3xl text-sm text-oo-stone-gray">
          Search vendors for launch support. Open a row for rescue tools: pause/hide, profile repair, pod membership,
          menu/POS status, and audit history.
        </p>
      </div>

      <AdminVendorSearchForm initialQuery={query} />

      {query ? (
        <div className="overflow-x-auto rounded-xl border border-oo-light-stone bg-oo-warm-white">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-oo-light-stone text-oo-stone-gray">
                <th className="px-4 py-3 font-medium">Vendor</th>
                <th className="px-4 py-3 font-medium">State</th>
                <th className="px-4 py-3 font-medium">Pods</th>
                <th className="px-4 py-3 font-medium">Owners</th>
                <th className="px-4 py-3 font-medium">POS / Stripe</th>
              </tr>
            </thead>
            <tbody>
              {results.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-oo-stone-gray">
                    No vendors matched &ldquo;{query}&rdquo;.
                  </td>
                </tr>
              ) : (
                results.map((row) => (
                  <tr key={row.id} className="border-b border-oo-light-stone/70 last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/admin/vendors/${row.id}`} className="font-medium underline">
                        {row.name}
                      </Link>
                      <p className="font-mono text-xs text-oo-stone-gray">{row.slug}</p>
                      <p className="text-xs text-oo-stone-gray">{row.publicPathPreview}</p>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {!row.isActive ? "Hidden" : row.mennyuOrdersPaused ? "Ordering paused" : "Public"}
                    </td>
                    <td className="px-4 py-3 text-xs text-oo-stone-gray">
                      {row.podNames.length > 0 ? row.podNames.join(", ") : "None"}
                    </td>
                    <td className="px-4 py-3 text-xs text-oo-stone-gray">
                      {row.ownerEmails.length > 0 ? row.ownerEmails.join(", ") : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-oo-stone-gray">
                      {row.menuSyncLabel}
                      <br />
                      {row.stripeSummary}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-oo-stone-gray">Enter a search term to find vendors, or open a vendor from orders/pods.</p>
      )}
    </div>
  );
}
