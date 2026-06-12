import { notFound } from "next/navigation";
import { RecentVendorViewTracker } from "@/components/retention/RecentViewTracker";
import { VendorMenuExperience } from "@/components/vendor-menu/VendorMenuExperience";
import { VendorMenuHero } from "@/components/vendor-menu/VendorMenuHero";
import { getOrCreateCartForVendorMenuAction } from "@/actions/cart.actions";
import { prisma } from "@/lib/db";
import { getVendorOrderabilityInPod } from "@/lib/vendor-orderability-in-pod";
import { loadCustomerVendorMenuSections } from "@/services/vendor-customer-menu.service";

const DEBUG_VENDOR_MENU_PAGE = process.env.NODE_ENV === "development";

export default async function VendorMenuPage({
  params,
}: {
  params: Promise<{ podId: string; vendorId: string }>;
}) {
  const { podId, vendorId } = await params;
  const pageStarted = DEBUG_VENDOR_MENU_PAGE ? Date.now() : 0;

  const pod = await prisma.pod.findUnique({
    where: { id: podId },
    select: {
      id: true,
      name: true,
      isActive: true,
      accentColor: true,
      vendors: {
        where: { vendorId },
        select: {
          isActive: true,
          vendor: {
            select: {
              id: true,
              name: true,
              description: true,
              imageUrl: true,
              accentColor: true,
              cuisineCategory: true,
              isActive: true,
              mennyuOrdersPaused: true,
              deliverectChannelLinkId: true,
            },
          },
        },
      },
    },
  });
  const pv = pod?.vendors[0];
  const vendor = pv?.vendor;
  if (!pod || !pod.isActive || !vendor) notFound();

  const menuStarted = DEBUG_VENDOR_MENU_PAGE ? Date.now() : 0;
  const cartStarted = DEBUG_VENDOR_MENU_PAGE ? Date.now() : 0;

  const [{ sections, variantChildCountByParentPlu }, cart] = await Promise.all([
    loadCustomerVendorMenuSections(vendorId),
    getOrCreateCartForVendorMenuAction(podId),
  ]);

  if (DEBUG_VENDOR_MENU_PAGE) {
    console.info("[vendor-menu-page] load timing", {
      vendorId,
      podId,
      menuMs: Date.now() - menuStarted,
      cartMs: Date.now() - cartStarted,
      totalMs: Date.now() - pageStarted,
      sectionCount: sections.length,
      cartItemCount: cart.items.length,
    });
  }

  const orderability = getVendorOrderabilityInPod({
    podActive: pod.isActive,
    podVendorExists: Boolean(pv),
    podVendorActive: pv?.isActive ?? false,
    vendor,
  });
  const orderingDisabled = !orderability.orderable;
  const bannerLine = orderingDisabled ? orderability.message ?? null : null;
  const availabilityStatus = orderingDisabled
    ? orderability.reason === "vendor_closed"
      ? ("closed" as const)
      : orderability.reason === "vendor_paused" || orderability.reason === "pod_vendor_paused"
        ? ("mennyu_paused" as const)
        : ("inactive" as const)
    : ("open" as const);

  return (
    <div className="w-full min-h-0">
      <RecentVendorViewTracker vendorId={vendorId} podId={podId} vendorName={vendor.name} />

      <VendorMenuHero
        podId={podId}
        podName={pod.name}
        podAccentColor={pod.accentColor}
        vendorId={vendorId}
        vendorName={vendor.name}
        vendorDescription={vendor.description}
        vendorImageUrl={vendor.imageUrl}
        vendorAccentColor={vendor.accentColor}
        cuisineCategory={vendor.cuisineCategory}
        availabilityStatus={availabilityStatus}
        bannerLine={bannerLine}
      />

      {sections.length === 0 ? (
        <div className="oo-shell py-12">
          <div className="oo-empty-state">
            <p className="font-medium text-zinc-900">This vendor has no menu items available right now.</p>
            <p className="mt-2 text-sm text-zinc-600">Check back later or browse other kitchens at {pod.name}.</p>
          </div>
        </div>
      ) : (
        <VendorMenuExperience
          podId={podId}
          podName={pod.name}
          vendorId={vendorId}
          vendorName={vendor.name}
          vendorAccentColor={vendor.accentColor}
          sections={sections}
          variantChildCountByParentPlu={variantChildCountByParentPlu}
          cart={cart}
          orderingDisabled={orderingDisabled}
          vendorUsesDeliverect={Boolean(vendor.deliverectChannelLinkId?.trim())}
        />
      )}
    </div>
  );
}
