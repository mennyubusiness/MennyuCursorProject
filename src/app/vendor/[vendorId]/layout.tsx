import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
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
      redirect(
        `/login?intent=vendor&callbackUrl=${encodeURIComponent(`/vendor/${vendorId}`)}`
      );
    }
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-2xl px-4 pt-4 pb-2">
          <h1 className="text-xl font-semibold text-stone-900">Vendor Dashboard</h1>
          <p className="mt-1 text-sm text-stone-500">{vendor.name}</p>
        </div>
        <VendorAreaNav vendorId={vendor.id} />
      </header>
      <main className="mx-auto max-w-2xl p-4">{children}</main>
    </div>
  );
}
