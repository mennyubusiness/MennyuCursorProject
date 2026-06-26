import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { buildLoginHrefWithReturn } from "@/lib/auth/login-return-path";
import { canAccessPodDashboardLayout } from "@/lib/permissions";
import { loadPodPayoutRecipientContext } from "@/services/pod-payout-connect.service";
import { arePodOwnerPayoutsConfigured } from "@/lib/pod-owner-payout-visibility";
import { PodLayoutChrome } from "./PodLayoutChrome";

export default async function PodAreaLayout({
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

  const payoutContext = await loadPodPayoutRecipientContext(podId);
  const showPayouts = arePodOwnerPayoutsConfigured({
    podPayoutsEnabled: payoutContext?.podPayoutsEnabled ?? false,
  });

  return (
    <PodLayoutChrome podId={pod.id} podName={pod.name} showPayouts={showPayouts}>
      {children}
    </PodLayoutChrome>
  );
}
