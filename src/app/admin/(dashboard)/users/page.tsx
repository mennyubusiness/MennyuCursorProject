import Link from "next/link";
import { searchAdminUsers } from "@/services/admin-user-search.service";
import { AdminUserSearchForm } from "./AdminUserSearchForm";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const query = sp.q?.trim() ?? "";
  const results = query ? await searchAdminUsers(query) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-oo-charcoal">Users</h1>
        <p className="mt-1 max-w-3xl text-sm text-oo-stone-gray">
          Search accounts by email, name, phone, user id, vendor name, pod name, order id, or invite
          email. Open a user to review access and run recovery actions.
        </p>
      </div>

      <AdminUserSearchForm initialQuery={query} />

      {query ? (
        <div className="overflow-x-auto rounded-xl border border-oo-light-stone bg-oo-warm-white">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-oo-light-stone text-oo-stone-gray">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Roles</th>
                <th className="px-4 py-3 font-medium">Linked</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {results.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-oo-stone-gray">
                    No users matched &ldquo;{query}&rdquo;.
                  </td>
                </tr>
              ) : (
                results.map((row) => (
                  <tr key={row.id} className="border-b border-oo-light-stone/70 last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/admin/users/${row.id}`} className="font-medium text-oo-charcoal underline">
                        {row.name?.trim() || row.email}
                      </Link>
                      <p className="text-xs text-oo-stone-gray">{row.email}</p>
                      {row.phone ? <p className="text-xs text-oo-stone-gray">{row.phone}</p> : null}
                    </td>
                    <td className="px-4 py-3">
                      <p>{row.accountStatus}</p>
                      <p className="text-xs text-oo-stone-gray">Last login: {row.lastLoginLabel}</p>
                    </td>
                    <td className="px-4 py-3 text-oo-stone-gray">{row.roleSummary}</td>
                    <td className="px-4 py-3 text-xs text-oo-stone-gray">
                      {row.vendorNames.length > 0 ? `Vendors: ${row.vendorNames.join(", ")}` : "No vendors"}
                      <br />
                      {row.podNames.length > 0 ? `Pods: ${row.podNames.join(", ")}` : "No pods"}
                      {row.recentOrderCount > 0 ? (
                        <>
                          <br />
                          {row.recentOrderCount} orders (90d)
                        </>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-oo-stone-gray">
                      {new Date(row.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-oo-stone-gray">Enter a search term to find users.</p>
      )}
    </div>
  );
}
