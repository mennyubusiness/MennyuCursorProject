import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { buildLoginHrefWithReturn } from "@/lib/auth/login-return-path";
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
    select: { id: true, name: true, vendorDashboardToken: true },
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

  return (
    <VendorLayoutChrome vendorId={vendor.id} vendorName={vendor.name}>
      {children}
    </VendorLayoutChrome>
  );
}
