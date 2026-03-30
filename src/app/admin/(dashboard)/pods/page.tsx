import Link from "next/link";
import { prisma } from "@/lib/db";
import { AdminPodToggle } from "./AdminPodToggle";

export default async function AdminPodsPage() {
  const pods = await prisma.pod.findMany({
    include: {
      vendors: { include: { vendor: { select: { id: true, name: true } } } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <h1 className="text-xl font-semibold text-stone-900">Pods</h1>
      <p className="mt-1 text-sm text-stone-600">
        Manage marketplace entities. Toggle active state and view vendor membership.
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[400px] border-collapse rounded-lg border border-stone-200 bg-white">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50">
              <th className="px-4 py-2 text-left text-sm font-medium text-stone-700">Name</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-stone-700">Active</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-stone-700">Vendors</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-stone-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pods.map((p) => (
              <tr key={p.id} className="border-b border-stone-100">
                <td className="px-4 py-2">
                  <span className="font-medium text-stone-900">{p.name}</span>
                  <p className="text-xs text-stone-500">{p.slug}</p>
                </td>
                <td className="px-4 py-2">
                  <span className={p.isActive ? "text-green-700" : "text-stone-500"}>
                    {p.isActive ? "Yes" : "No"}
                  </span>
                </td>
                <td className="px-4 py-2 text-sm text-stone-600">
                  {p.vendors.length === 0
                    ? "—"
                    : p.vendors.map((v) => v.vendor.name).join(", ")}
                </td>
                <td className="px-4 py-2 flex flex-wrap items-center gap-2">
                  <Link
                    href={`/pod/${p.id}/dashboard`}
                    className="rounded border border-stone-300 px-2 py-1 text-xs hover:bg-stone-100"
                  >
                    Pod overview
                  </Link>
                  <AdminPodToggle podId={p.id} isActive={p.isActive} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
