import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

/**
 * Hub: sends the user to their vendor area (single vendor) or chooser (multiple).
 * Matches post-login default routing for vendor memberships.
 */
export default async function VendorDashboardHubPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?${new URLSearchParams({ callbackUrl: "/vendor/dashboard" }).toString()}`);
  }

  const memberships = await prisma.vendorMembership.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { vendorId: true },
  });

  if (memberships.length === 0) {
    redirect("/orders");
  }
  if (memberships.length === 1) {
    redirect(`/vendor/${memberships[0].vendorId}`);
  }
  redirect("/vendor/select");
}
