/**
 * Pod Analytics: same access guard as pod dashboard.
 */
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdminDashboardLayoutAuthorized } from "@/lib/admin-auth";
import { env } from "@/lib/env";
import { PodAreaNav } from "../PodAreaNav";

export default async function PodAnalyticsLayout({
  params,
  children,
}: {
  params: Promise<{ podId: string }>;
  children: React.ReactNode;
}) {
  const allowed = await isAdminDashboardLayoutAuthorized();
  if (!allowed) {
    if (env.NODE_ENV === "production" && env.ADMIN_SECRET) {
      redirect("/admin/access-denied");
    }
  }

  const { podId } = await params;
  const pod = await prisma.pod.findUnique({
    where: { id: podId },
    select: { id: true, name: true },
  });
  if (!pod) notFound();

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-2xl px-4 pt-4 pb-2">
          <h1 className="text-xl font-semibold text-stone-900">Pod Dashboard</h1>
          <p className="mt-1 text-sm text-stone-500">{pod.name}</p>
        </div>
        <PodAreaNav />
      </header>
      {children}
    </div>
  );
}
