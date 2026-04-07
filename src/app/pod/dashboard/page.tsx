import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

/**
 * Hub: sends the user to their most recently joined pod dashboard.
 * Matches post-login default routing for pod memberships.
 */
export default async function PodDashboardHubPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?${new URLSearchParams({ callbackUrl: "/pod/dashboard" }).toString()}`);
  }

  const rows = await prisma.podMembership.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { podId: true },
  });

  if (rows.length === 0) {
    redirect("/orders");
  }
  redirect(`/pod/${rows[0].podId}/dashboard`);
}
