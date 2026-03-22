import Link from "next/link";
import { fetchAdminMenuImportJobsList } from "@/lib/admin-menu-import-queries";

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "short", timeStyle: "short" }).format(d);
}

export default async function AdminMenuImportsListPage() {
  const jobs = await fetchAdminMenuImportJobsList(50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Menu imports</h1>
        <p className="mt-1 text-sm text-stone-600">
          Review Deliverect menu import jobs and draft canonical menus (read-only).
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-2 font-medium">Started</th>
              <th className="px-4 py-2 font-medium">Vendor</th>
              <th className="px-4 py-2 font-medium">Source</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Draft</th>
              <th className="px-4 py-2 font-medium">Issues</th>
              <th className="px-4 py-2 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-stone-500">
                  No menu import jobs yet.
                </td>
              </tr>
            ) : (
              jobs.map((j) => (
                <tr key={j.id} className="hover:bg-stone-50">
                  <td className="whitespace-nowrap px-4 py-2 text-stone-700">{formatDate(j.startedAt)}</td>
                  <td className="px-4 py-2 text-stone-900">{j.vendor.name}</td>
                  <td className="px-4 py-2 font-mono text-xs text-stone-600">{j.source}</td>
                  <td className="px-4 py-2 font-mono text-xs text-stone-800">{j.status}</td>
                  <td className="px-4 py-2 font-mono text-xs text-stone-600">
                    {j.draftVersionId ? j.draftVersionId.slice(0, 8) + "…" : "—"}
                  </td>
                  <td className="px-4 py-2 text-stone-700">{j._count.issues}</td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/admin/menu-imports/${j.id}`}
                      className="text-sky-700 hover:underline"
                    >
                      Review
                    </Link>
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
