import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminModeBanner } from "@/components/admin/AdminModeBanner";
import { prisma } from "@/lib/db";
import {
  getVendorDashboardEmailVerificationRedirect,
  shouldSkipEmailVerificationGate,
} from "@/lib/auth/email-verification-access.server";
import { buildLoginHrefWithReturn } from "@/lib/auth/login-return-path";
import { shouldShowAdminModeBannerForVendor } from "@/lib/admin-mode-context";
import { canAccessVendorDashboard, isVendorDashboardDevOpen } from "@/lib/vendor-dashboard-auth";
import { VendorLayoutChrome } from "./VendorLayoutChrome";

export default async function VendorAreaLayout({
  params,
  children,
}: {
  params: Promise<{ vendorId: string }>;
  children: React.ReactNode;
}) {
  const { vendorId } = await params;

  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { id: true, name: true, menuSource: true, vendorDashboardToken: true },
  });
  if (!vendor) notFound();

  if (!isVendorDashboardDevOpen()) {
    const allowed = await canAccessVendorDashboard(vendorId);
    if (!allowed) {
      const session = await auth();
      if (session?.user?.id) {
        notFound();
      }
      if (vendor.vendorDashboardToken?.trim()) {
        redirect(`/vendor/${vendorId}/settings?access=needs_session`);
      }
      redirect(buildLoginHrefWithReturn(`/vendor/${vendorId}`));
    }
  }

  if (!(await shouldSkipEmailVerificationGate())) {
    const session = await auth();
    if (session?.user?.id) {
      const emailRedirect = await getVendorDashboardEmailVerificationRedirect({
        userId: session.user.id,
        vendorId,
        emailVerified: Boolean(session.user.isEmailVerified),
      });
      if (emailRedirect) redirect(emailRedirect);
    }
  }

  const showAdminBanner = await shouldShowAdminModeBannerForVendor(vendorId);

  return (
    <>
      {showAdminBanner ? <AdminModeBanner sticky /> : null}
      <VendorLayoutChrome vendorId={vendor.id} vendorName={vendor.name} menuSource={vendor.menuSource}>
        {children}
      </VendorLayoutChrome>
    </>
  );
}
