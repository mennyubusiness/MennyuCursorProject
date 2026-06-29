import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  DashboardCard,
  DashboardPageHeader,
  DashboardSection,
  DashboardShell,
} from "@/components/dashboard";
import { buildVendorMenuCustomerPath } from "@/lib/customer-public-url";
import { prisma } from "@/lib/db";
import { resolveLegacyVendorSettingsRedirect } from "@/lib/vendor-settings-sections";
import { VendorAccessQueryMessages } from "./VendorAccessMessages";
import { VendorBrandProfileForm } from "./VendorBrandProfileForm";

export default async function VendorProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ vendorId: string }>;
  searchParams: Promise<{
    stripe_connect?: string;
    payout_notice?: string;
    section?: string;
    access?: string;
  }>;
}) {
  const { vendorId } = await params;
  const sp = await searchParams;

  if (sp.stripe_connect === "return" || sp.stripe_connect === "refresh") {
    const params = new URLSearchParams();
    params.set("stripe_connect", sp.stripe_connect);
    if (sp.stripe_connect === "refresh") params.set("payout_notice", "link_expired");
    redirect(`/vendor/${vendorId}/payouts?${params.toString()}`);
  }

  const legacyRedirect = resolveLegacyVendorSettingsRedirect(vendorId, sp.section, {
    access: sp.access,
    payout_notice: sp.payout_notice,
  });
  if (legacyRedirect) redirect(legacyRedirect);

  const [vendor, currentPod] = await Promise.all([
    prisma.vendor.findUnique({
      where: { id: vendorId },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        imageUrl: true,
        accentColor: true,
        cuisineCategory: true,
      },
    }),
    prisma.podVendor.findFirst({
      where: { vendorId },
      select: { pod: { select: { slug: true } } },
    }),
  ]);

  if (!vendor) notFound();

  const publicPagePath =
    currentPod?.pod.slug && vendor.slug
      ? buildVendorMenuCustomerPath(currentPod.pod.slug, vendor.slug)
      : null;

  return (
    <DashboardShell tier="workspace" className="px-0 pb-0 pt-0">
      <Suspense fallback={null}>
        <VendorAccessQueryMessages />
      </Suspense>

      <DashboardPageHeader
        headingLevel={1}
        title="Vendor Profile"
        description="Manage the public details customers see for this vendor."
      />

      <div className="mt-8 space-y-8">
        <DashboardSection
          id="public-profile"
          title="Public profile"
          description="Name, cuisine, description, logo, and banner photo shown on your public menu page."
        >
          <DashboardCard className="max-w-3xl">
            <p className="text-xs text-oo-stone-gray">
              URL slug: <span className="font-mono text-oo-charcoal">{vendor.slug}</span> (not editable here)
            </p>
            {publicPagePath ? (
              <p className="mt-2 text-sm">
                <Link
                  href={publicPagePath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-oo-charcoal underline"
                >
                  View public page
                </Link>
              </p>
            ) : (
              <p className="mt-2 text-sm text-oo-stone-gray">
                Public page link appears after this vendor is linked to a pod.
              </p>
            )}
            <div className="mt-4">
              <VendorBrandProfileForm
                vendorId={vendor.id}
                initialName={vendor.name}
                initialDescription={vendor.description}
                initialImageUrl={vendor.imageUrl}
                initialAccentColor={vendor.accentColor}
                initialCuisineCategory={vendor.cuisineCategory}
              />
            </div>
          </DashboardCard>
        </DashboardSection>
      </div>
    </DashboardShell>
  );
}
