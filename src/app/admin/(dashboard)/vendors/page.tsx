import Link from "next/link";
import { prisma } from "@/lib/db";
import { getLatestActionableMenuImportJobIdByVendorMap } from "@/lib/admin-menu-import-queries";
import { AdminVendorToggle } from "./AdminVendorToggle";

export default async function AdminVendorsPage() {
  const vendors = await prisma.vendor.findMany({
    include: {
      pods: { include: { pod: { select: { id: true, name: true } } } },
      _count: { select: { vendorOrders: true } },
    },
    orderBy: { name: "asc" },
  });

  const pendingJobByVendor = await getLatestActionableMenuImportJobIdByVendorMap(vendors.map((v) => v.id));

  return (
    <div>
      <h1 className="text-xl font-semibold text-stone-900">Vendors</h1>
      <p className="mt-1 text-sm text-stone-600">
        Manage marketplace entities. Toggle active state and view pod associations.
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[400px] border-collapse rounded-lg border border-stone-200 bg-white">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50">
              <th className="px-4 py-2 text-left text-sm font-medium text-stone-700">Name</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-stone-700">Active</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-stone-700">Pods</th>
              <th className="px-4 py-2 text-right text-sm font-medium text-stone-700">Orders</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-stone-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {vendors.map((v) => (
              <tr key={v.id} className="border-b border-stone-100">
                <td className="px-4 py-2">
                  <span className="font-medium text-stone-900">{v.name}</span>
                  <p className="text-xs text-stone-500">{v.slug}</p>
                  {pendingJobByVendor.has(v.id) && (
                    <p className="mt-1">
                      <Link
                        href={`/admin/menu-imports/${pendingJobByVendor.get(v.id)}#admin-menu-import-publish`}
                        className="inline-block rounded bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-900 hover:bg-sky-200"
                      >
                        Menu update available — review
                      </Link>
                    </p>
                  )}
                </td>
                <td className="px-4 py-2">
                  <span className={v.isActive ? "text-green-700" : "text-stone-500"}>
                    {v.isActive ? "Yes" : "No"}
                  </span>
                </td>
                <td className="px-4 py-2 text-sm text-stone-600">
                  {v.pods.length === 0
                    ? "—"
                    : v.pods.map((p) => p.pod.name).join(", ")}
                </td>
                <td className="px-4 py-2 text-right text-sm text-stone-600">
                  {v._count.vendorOrders}
                </td>
                <td className="px-4 py-2">
                  <AdminVendorToggle vendorId={v.id} isActive={v.isActive} />
                  <Link
                    href={`/admin/vendors/${v.id}/menu-history`}
                    className="ml-2 text-sm text-sky-800 hover:underline"
                  >
                    Menu history
                  </Link>
                  <Link
                    href={`/admin/vendors/${v.id}/deliverect-mapping`}
                    className="ml-2 text-sm text-amber-800 hover:underline"
                  >
                    Deliverect IDs
                  </Link>
                  <Link
                    href={`/vendor/${v.id}/orders`}
                    className="ml-2 text-sm text-stone-600 hover:underline"
                  >
                    Vendor area
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
