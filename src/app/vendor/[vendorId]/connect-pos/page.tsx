import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canViewVendor } from "@/lib/permissions";
import { hasUnmatchedChannelRegistrationForVendorById } from "@/services/deliverect-channel-registration-retry.service";
import { ConnectPosWizard } from "./ConnectPosWizard";

export default async function VendorConnectPosPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/vendor/${vendorId}/connect-pos`)}`);
  }
  if (!(await canViewVendor(session.user.id, vendorId))) {
    notFound();
  }

  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: {
      id: true,
      name: true,
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

  const hasUnmatchedChannelRegistration = await hasUnmatchedChannelRegistrationForVendorById(vendorId);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-stone-500">
          <Link href={`/vendor/${vendorId}/orders`} className="hover:text-stone-800">
            ← Orders
          </Link>
        </p>
        <h2 className="mt-2 text-xl font-semibold text-stone-900">Connect your POS</h2>
        <p className="mt-1 text-sm text-stone-600">{vendor.name}</p>
      </div>
      <ConnectPosWizard vendor={{ ...vendor, hasUnmatchedChannelRegistration }} />
    </div>
  );
}
