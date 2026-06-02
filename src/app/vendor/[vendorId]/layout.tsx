import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { buildLoginHrefWithReturn } from "@/lib/auth/login-return-path";
import { canAccessVendorDashboard, isVendorDashboardDevOpen } from "@/lib/vendor-dashboard-auth";
import { VendorAreaNav } from "./VendorAreaNav";

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
    <div className="oo-dash">
      <header className="oo-dash-titlebar">
        <div className="mx-auto max-w-2xl px-4 pb-2 pt-4">
          <h1 className="oo-dash-titlebar-heading">{vendor.name}</h1>
        </div>
        <VendorAreaNav vendorId={vendor.id} />
      </header>
      <main className="mx-auto max-w-2xl p-4">{children}</main>
    </div>
  );
}
