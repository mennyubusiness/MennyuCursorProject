/**
 * Pod dashboard: platform admin (cookie/session), or PodMembership for this podId.
 */
import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { canAccessPodDashboardLayout } from "@/lib/permissions";
import { PodAreaNav } from "../PodAreaNav";

export default async function PodDashboardLayout({
  params,
  children,
}: {
  params: Promise<{ podId: string }>;
  children: React.ReactNode;
}) {
  const { podId } = await params;

  const allowed = await canAccessPodDashboardLayout(podId);
  if (!allowed) {
    if (env.NODE_ENV === "production") {
      const session = await auth();
      if (!session?.user?.id) {
        redirect(`/login?callbackUrl=${encodeURIComponent(`/pod/${podId}/dashboard`)}`);
      }
      redirect("/admin/access-denied");
    }
  }

  const pod = await prisma.pod.findUnique({
    where: { id: podId },
    select: { id: true, name: true },
  });
  if (!pod) notFound();

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-2xl px-4 pt-4 pb-2">
          <h1 className="text-xl font-semibold text-stone-900">Pod</h1>
          <p className="mt-1 text-sm text-stone-500">{pod.name}</p>
        </div>
        <PodAreaNav />
      </header>
      {children}
    </div>
  );
}
