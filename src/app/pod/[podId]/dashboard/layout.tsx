/**
 * Pod dashboard: platform admin (cookie/session), or PodMembership for this podId.
 */
import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { buildLoginHrefWithReturn } from "@/lib/auth/login-return-path";
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
        redirect(buildLoginHrefWithReturn(`/pod/${podId}/dashboard`));
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
    <div className="oo-dash">
      <header className="oo-dash-titlebar">
        <div className="mx-auto max-w-2xl px-4 pb-2 pt-4">
          <h1 className="oo-dash-titlebar-heading">Pod</h1>
          <p className="oo-dash-titlebar-sub">{pod.name}</p>
        </div>
        <PodAreaNav />
      </header>
      {children}
    </div>
  );
}
