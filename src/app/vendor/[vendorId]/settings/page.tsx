import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { canManageVendor } from "@/lib/permissions";
import { env } from "@/lib/env";
import { retrieveAndSyncVendorConnectedAccount } from "@/services/stripe-connect.service";
import { prisma } from "@/lib/db";
import { evaluateDeliverectMenuIntegrityForVendor } from "@/services/deliverect-menu-integrity.service";
import { hasUnmatchedChannelRegistrationForVendorById } from "@/services/deliverect-channel-registration-retry.service";
import { deriveVendorPodReadiness } from "@/lib/vendor-pod-readiness";
import { loadVendorMenuReadinessSummaries } from "@/lib/vendor-menu-readiness.server";
import {
  buildVendorSettingsSectionBadges,
  resolveVendorSettingsSection,
} from "@/lib/vendor-settings-sections";
import { VendorAccessQueryMessages } from "./VendorAccessMessages";
import { VendorSettingsSectionPanels } from "./VendorSettingsSectionPanels";
import { VendorSettingsShell } from "./VendorSettingsShell";

function countStripeRequirementsDue(value: unknown): number {
  if (value == null) return 0;
  return Array.isArray(value) ? value.length : 0;
}

function settingsRedirectPath(
  vendorId: string,
  section: "overview" | "payouts" = "payouts",
  extra?: Record<string, string>
): string {
  const params = new URLSearchParams();
  if (section !== "overview") params.set("section", section);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `/vendor/${vendorId}/settings?${qs}` : `/vendor/${vendorId}/settings`;
}

export default async function VendorSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ vendorId: string }>;
  searchParams: Promise<{ stripe_connect?: string; payout_notice?: string; section?: string; access?: string }>;
}) {
  const { vendorId } = await params;
  const sp = await searchParams;
  const session = await auth();
  const activeSection = resolveVendorSettingsSection(sp.section);

  const connect = sp.stripe_connect;
  if (connect === "return" || connect === "refresh") {
    const userId = session?.user?.id;
    if (userId && (await canManageVendor(userId, vendorId))) {
      try {
        await retrieveAndSyncVendorConnectedAccount(vendorId);
      } catch (e) {
        console.error("[vendor settings] Stripe Connect sync failed", e);
      }
    }
    if (connect === "refresh") {
      redirect(settingsRedirectPath(vendorId, "payouts", { payout_notice: "link_expired" }));
    }
    redirect(settingsRedirectPath(vendorId, "payouts"));
  }

  const [vendor, pendingRequests, recentRequests, currentPod] = await Promise.all([
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
        contactEmail: true,
        contactPhone: true,
        isActive: true,
        mennyuOrdersPaused: true,
        autoPublishMenus: true,
        vendorDashboardToken: true,
        deliverectChannelLinkId: true,
        deliverectLocationId: true,
        posConnectionStatus: true,
        pendingDeliverectConnectionKey: true,
        deliverectAutoMapLastOutcome: true,
        deliverectAutoMapLastAt: true,
        stripeConnectedAccountId: true,
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
        stripeOnboardingCompletedAt: true,
        stripeRequirementsCurrentlyDue: true,
      },
    }),
    prisma.podMembershipRequest.findMany({
      where: { vendorId, status: "pending" },
      include: { pod: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.podMembershipRequest.findMany({
      where: { vendorId, status: { not: "pending" } },
      include: { pod: { select: { id: true, name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    prisma.podVendor.findFirst({
      where: { vendorId },
      select: {
        isActive: true,
        pod: { select: { id: true, name: true, isActive: true } },
      },
    }),
  ]);

  if (!vendor) notFound();

  const [hasUnmatchedChannelRegistration, menuSummaries] = await Promise.all([
    hasUnmatchedChannelRegistrationForVendorById(vendorId),
    loadVendorMenuReadinessSummaries([vendorId]),
  ]);

  const deliverectMenuIntegrity =
    vendor.deliverectChannelLinkId?.trim() != null && vendor.deliverectChannelLinkId.trim() !== ""
      ? await evaluateDeliverectMenuIntegrityForVendor(vendorId)
      : null;

  const pendingRequestsForComponent = pendingRequests.map((r) => ({
    id: r.id,
    podId: r.pod.id,
    podName: r.pod.name,
    createdAt: r.createdAt.toISOString(),
  }));

  const recentRequestsForComponent = recentRequests.map((r) => ({
    id: r.id,
    podId: r.pod.id,
    podName: r.pod.name,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    respondedAt: r.respondedAt?.toISOString() ?? null,
  }));

  const hasToken = Boolean(vendor.vendorDashboardToken?.trim());
  const vendorReadiness = deriveVendorPodReadiness(
    {
      podId: currentPod?.pod.id ?? vendorId,
      vendorId,
      pod: { isActive: currentPod?.pod.isActive ?? true },
      podVendor: currentPod ? { isActive: currentPod.isActive } : null,
      vendor: {
        isActive: vendor.isActive,
        mennyuOrdersPaused: vendor.mennyuOrdersPaused ?? false,
        name: vendor.name,
        slug: vendor.slug,
        description: vendor.description,
        imageUrl: vendor.imageUrl,
        cuisineCategory: vendor.cuisineCategory,
        contactEmail: vendor.contactEmail,
        contactPhone: vendor.contactPhone,
      },
      menuSummary: menuSummaries.get(vendorId) ?? {
        hasPublishedMenuVersion: false,
        hasOperationalItems: false,
        hasAvailableOperationalItems: false,
      },
      posSummary: {
        deliverectChannelLinkId: vendor.deliverectChannelLinkId,
        posConnectionStatus: vendor.posConnectionStatus,
        deliverectAutoMapLastOutcome: vendor.deliverectAutoMapLastOutcome,
        pendingDeliverectConnectionKey: vendor.pendingDeliverectConnectionKey,
        hasUnmatchedChannelRegistration,
      },
      stripeSummary: {
        stripeConnectedAccountId: vendor.stripeConnectedAccountId,
        stripeChargesEnabled: vendor.stripeChargesEnabled ?? false,
        stripePayoutsEnabled: vendor.stripePayoutsEnabled ?? false,
        stripeConnectConfigured: Boolean(env.STRIPE_SECRET_KEY),
      },
      pendingPodInviteCount: pendingRequests.length,
      hasPodMembership: Boolean(currentPod),
    },
    { audience: "vendor" }
  );

  const badges = buildVendorSettingsSectionBadges({
    setupSummary: vendorReadiness.setupSummary,
    pendingPodInviteCount: pendingRequests.length,
    hasPodMembership: Boolean(currentPod),
  });

  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <VendorAccessQueryMessages />
      </Suspense>

      <VendorSettingsShell
        vendorId={vendor.id}
        vendorName={vendor.name}
        activeSection={activeSection}
        badges={badges}
        setupSummary={vendorReadiness.setupSummary}
      >
        <VendorSettingsSectionPanels
          vendorId={vendor.id}
          vendorName={vendor.name}
          vendorSlug={vendor.slug}
          vendorDescription={vendor.description}
          vendorImageUrl={vendor.imageUrl}
          vendorAccentColor={vendor.accentColor}
          section={activeSection}
          checklist={vendorReadiness.checklist}
          badges={badges}
          ordersPaused={vendor.mennyuOrdersPaused ?? false}
          autoPublishMenus={vendor.autoPublishMenus ?? false}
          deliverectChannelLinkId={vendor.deliverectChannelLinkId}
          deliverectLocationId={vendor.deliverectLocationId}
          posConnectionStatus={vendor.posConnectionStatus}
          pendingDeliverectConnectionKey={vendor.pendingDeliverectConnectionKey}
          deliverectAutoMapLastOutcome={vendor.deliverectAutoMapLastOutcome}
          deliverectAutoMapLastAt={vendor.deliverectAutoMapLastAt}
          hasUnmatchedChannelRegistration={hasUnmatchedChannelRegistration}
          deliverectMenuIntegrity={deliverectMenuIntegrity}
          stripeConnectConfigured={Boolean(env.STRIPE_SECRET_KEY)}
          stripeConnectedAccountId={vendor.stripeConnectedAccountId ?? null}
          stripeChargesEnabled={vendor.stripeChargesEnabled ?? false}
          stripePayoutsEnabled={vendor.stripePayoutsEnabled ?? false}
          stripeOnboardingCompletedAt={vendor.stripeOnboardingCompletedAt?.toISOString() ?? null}
          requirementsPendingCount={countStripeRequirementsDue(vendor.stripeRequirementsCurrentlyDue)}
          payoutNotice={sp.payout_notice === "link_expired" ? "link_expired" : null}
          pendingPodRequests={pendingRequestsForComponent}
          recentPodRequests={recentRequestsForComponent}
          currentPod={currentPod ? { id: currentPod.pod.id, name: currentPod.pod.name } : null}
          hasDashboardSecret={hasToken}
          userEmail={session?.user?.email ?? null}
          isPlatformAdmin={Boolean(session?.user?.isPlatformAdmin)}
        />
      </VendorSettingsShell>
    </div>
  );
}
