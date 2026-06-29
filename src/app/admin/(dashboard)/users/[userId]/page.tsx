import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { loadAdminUserDetail } from "@/services/admin-user-detail.service";
import { AdminUserDetailClient } from "./AdminUserDetailClient";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const detail = await loadAdminUserDetail(userId);
  if (!detail) notFound();

  const [vendorOptions, podOptions] = await Promise.all([
    prisma.vendor.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
    prisma.pod.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/users" className="text-sm text-oo-stone-gray underline">
          ← Back to user search
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-oo-charcoal">
          {detail.user.name?.trim() || detail.user.email}
        </h1>
        <p className="text-sm text-oo-stone-gray">{detail.user.email}</p>
        <p className="text-xs text-oo-stone-gray">User ID: {detail.user.id}</p>
      </div>

      <AdminUserDetailClient
        detail={detail}
        vendorOptions={vendorOptions}
        podOptions={podOptions}
      />
    </div>
  );
}
