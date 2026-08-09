import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { buildLoginHrefWithReturn } from "@/lib/auth/login-return-path";
import { canViewVendor } from "@/lib/permissions";
import { isManualDashboardRoutingMode } from "@/lib/vendor-order-routing-mode";
import { isOpenOrderMenuSource } from "@/lib/vendor-menu-source";
import { vendorMayConfigurePosOrderRouting } from "@/lib/vendor-routing-availability";
import { hasUnmatchedChannelRegistrationForVendorById } from "@/services/deliverect-channel-registration-retry.service";
import { ConnectPosWizard } from "./ConnectPosWizard";

function TabletOnlyPosBlock({ vendorId, vendorName }: { vendorId: string; vendorName: string }) {
  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-oo-light-stone bg-oo-warm-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-oo-charcoal">POS connection not available</h2>
      <p className="text-sm text-oo-stone-gray">
        {vendorName} uses the Open Order dashboard for orders. Deliverect and other POS order-routing
        setup is not available. Manage incoming orders in Kitchen mode.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href={`/vendor/${vendorId}/kitchen`}
          className="inline-flex items-center justify-center rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-hover"
        >
          Open kitchen mode
        </Link>
        <Link
          href={`/vendor/${vendorId}/setup`}
          className="inline-flex items-center justify-center rounded-xl border border-oo-light-stone px-4 py-2.5 text-sm font-semibold text-oo-charcoal hover:bg-oo-cream"
        >
          Back to setup
        </Link>
      </div>
    </div>
  );
}

export default async function VendorConnectPosPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(buildLoginHrefWithReturn(`/vendor/${vendorId}/connect-pos`));
  }
  if (!(await canViewVendor(session.user.id, vendorId))) {
    notFound();
  }

  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: {
      id: true,
      name: true,
      orderRoutingMode: true,
      menuSource: true,
      deliverectChannelLinkId: true,
      deliverectLocationId: true,
      deliverectAccountEmail: true,
      posProvider: true,
      posType: true,
      posConnectionStatus: true,
      pendingDeliverectConnectionKey: true,
      deliverectAutoMapLastAt: true,
      deliverectAutoMapLastOutcome: true,
      deliverectAutoMapLastDetail: true,
    },
  });
  if (!vendor) notFound();

  if (!vendorMayConfigurePosOrderRouting()) {
    return <TabletOnlyPosBlock vendorId={vendorId} vendorName={vendor.name} />;
  }

  if (isManualDashboardRoutingMode(vendor.orderRoutingMode) || isOpenOrderMenuSource(vendor)) {
    return <TabletOnlyPosBlock vendorId={vendorId} vendorName={vendor.name} />;
  }

  const hasUnmatchedChannelRegistration = await hasUnmatchedChannelRegistrationForVendorById(vendorId);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-oo-stone-gray">
          <Link href={`/vendor/${vendorId}/orders`} className="hover:text-oo-charcoal">
            ← Orders
          </Link>
        </p>
        <h2 className="mt-2 text-xl font-semibold text-oo-charcoal">Connect your POS</h2>
        <p className="mt-1 text-sm text-oo-stone-gray">{vendor.name}</p>
      </div>
      <ConnectPosWizard vendor={{ ...vendor, hasUnmatchedChannelRegistration }} />
    </div>
  );
}
