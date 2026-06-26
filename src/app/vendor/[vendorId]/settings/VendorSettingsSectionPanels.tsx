import Link from "next/link";
import type { PosConnectionStatus } from "@prisma/client";
import type { DeliverectMenuIntegrityReport } from "@/services/deliverect-menu-integrity.service";
import type { ReadinessChecklistItem } from "@/lib/vendor-pod-readiness";
import {
  type VendorSettingsSectionId,
  vendorSettingsSectionHref,
} from "@/lib/vendor-settings-sections";
import { DeliverectMenuHealthPanel } from "@/components/deliverect/DeliverectMenuHealthPanel";
import { MennyuLocationIdField } from "@/components/vendor/MennyuLocationIdField";
import { VendorPosConnectionPanel } from "@/components/vendor/VendorPosConnectionPanel";
import { VendorPodRequests } from "../dashboard/VendorPodRequests";
import { VendorRecentPodRequests } from "../dashboard/VendorRecentPodRequests";
import { VendorAutoPublishToggle } from "./VendorAutoPublishToggle";
import { VendorBrandProfileForm } from "./VendorBrandProfileForm";
import { VendorDashboardAccessCard } from "./VendorDashboardAccessCard";
import { VendorStripePayoutCard } from "./VendorStripePayoutCard";

export type VendorSettingsSectionPanelsProps = {
  vendorId: string;
  vendorName: string;
  vendorSlug: string;
  vendorDescription: string | null;
  vendorImageUrl: string | null;
  vendorAccentColor: string | null;
  section: VendorSettingsSectionId;
  checklist: ReadinessChecklistItem[];
  badges: Partial<Record<VendorSettingsSectionId, string>>;
  ordersPaused: boolean;
  autoPublishMenus: boolean;
  deliverectChannelLinkId: string | null;
  deliverectLocationId: string | null;
  posConnectionStatus: PosConnectionStatus;
  pendingDeliverectConnectionKey: string | null;
  deliverectAutoMapLastOutcome: string | null;
  deliverectAutoMapLastAt: Date | null;
  hasUnmatchedChannelRegistration: boolean;
  deliverectMenuIntegrity: DeliverectMenuIntegrityReport | null;
  stripeConnectConfigured: boolean;
  stripeConnectedAccountId: string | null;
  stripeChargesEnabled: boolean;
  stripePayoutsEnabled: boolean;
  stripeOnboardingCompletedAt: string | null;
  requirementsPendingCount: number;
  payoutNotice: "link_expired" | null;
  pendingPodRequests: Array<{ id: string; podId: string; podName: string; createdAt: string }>;
  recentPodRequests: Array<{
    id: string;
    podId: string;
    podName: string;
    status: string;
    createdAt: string;
    respondedAt: string | null;
  }>;
  currentPod: { id: string; name: string } | null;
  hasDashboardSecret: boolean;
  userEmail: string | null;
  isPlatformAdmin: boolean;
};

function OverviewSectionCards({
  vendorId,
  badges,
}: {
  vendorId: string;
  badges: Partial<Record<VendorSettingsSectionId, string>>;
}) {
  const cards: Array<{ section: VendorSettingsSectionId; label: string; badge?: string }> = [
    { section: "profile", label: "Business profile", badge: badges.profile },
    { section: "payouts", label: "Payouts", badge: badges.payouts },
    { section: "pos-menu", label: "POS & menu", badge: badges["pos-menu"] },
    { section: "pod-membership", label: "Pod membership", badge: badges["pod-membership"] },
    { section: "account", label: "Account", badge: badges.account },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {cards.map((card) => (
        <Link
          key={card.section}
          href={vendorSettingsSectionHref(vendorId, card.section)}
          className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-4 shadow-sm transition hover:border-stone-300 hover:shadow"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="font-medium text-oo-charcoal">{card.label}</span>
            {card.badge ? (
              <span className="rounded-full bg-oo-cream px-2 py-0.5 text-xs font-medium text-oo-charcoal">
                {card.badge}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-oo-stone-gray">Open section →</p>
        </Link>
      ))}
    </div>
  );
}

function PrimaryNextAction({ items }: { items: ReadinessChecklistItem[] }) {
  const next = items.find((item) => !item.complete);
  if (!next) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-950">
      <p className="font-semibold text-amber-950">Next step</p>
      <p className="mt-1">{next.label}</p>
      {next.description ? <p className="mt-1 text-amber-900/90">{next.description}</p> : null}
      {next.actionHref && next.actionLabel ? (
        <Link href={next.actionHref} className="mt-2 inline-block font-medium text-oo-charcoal underline">
          {next.actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

export function VendorSettingsSectionPanels(props: VendorSettingsSectionPanelsProps) {
  const { section, vendorId } = props;

  switch (section) {
    case "overview":
      return (
        <div className="space-y-6" data-settings-section="overview">
          <div>
            <h3 className="text-xl font-semibold text-oo-charcoal">Overview</h3>
            <p className="mt-1 text-sm text-oo-stone-gray">
              Account settings live here. Day-to-day operations use Dashboard, Orders, Menu, and Hours.
            </p>
          </div>
          {props.checklist.every((item) => item.complete) ? (
            <p className="rounded-xl border border-oo-light-stone bg-oo-cream/50 px-4 py-3 text-sm text-oo-stone-gray">
              No changes needed right now.
            </p>
          ) : (
            <PrimaryNextAction items={props.checklist} />
          )}
          <div className="flex flex-wrap gap-3 text-sm">
            <Link href={`/vendor/${vendorId}/setup`} className="font-medium text-oo-charcoal underline">
              Open setup checklist
            </Link>
            <Link href={`/vendor/${vendorId}/dashboard`} className="font-medium text-oo-charcoal underline">
              Go to dashboard
            </Link>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-oo-charcoal">Settings sections</h4>
            <div className="mt-3">
              <OverviewSectionCards vendorId={vendorId} badges={props.badges} />
            </div>
          </div>
        </div>
      );

    case "profile":
      return (
        <div className="space-y-4" data-settings-section="profile">
          <p className="text-xs text-oo-stone-gray">
            URL slug: <span className="font-mono">{props.vendorSlug}</span> (fixed)
          </p>
          <div className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-5 shadow-sm">
            <VendorBrandProfileForm
              vendorId={vendorId}
              initialName={props.vendorName}
              initialDescription={props.vendorDescription}
              initialImageUrl={props.vendorImageUrl}
              initialAccentColor={props.vendorAccentColor}
            />
          </div>
        </div>
      );

    case "payouts":
      return (
        <div className="space-y-4" data-settings-section="payouts">
          <p className="text-sm text-oo-stone-gray">
            Payout setup also lives on the{" "}
            <Link href={`/vendor/${vendorId}/payouts`} className="font-medium text-oo-charcoal underline">
              Payouts
            </Link>{" "}
            page in the main vendor nav.
          </p>
          <VendorStripePayoutCard
            vendorId={vendorId}
            stripeConnectConfigured={props.stripeConnectConfigured}
            stripeConnectedAccountId={props.stripeConnectedAccountId}
            stripeChargesEnabled={props.stripeChargesEnabled}
            stripePayoutsEnabled={props.stripePayoutsEnabled}
            stripeOnboardingCompletedAt={props.stripeOnboardingCompletedAt}
            requirementsPendingCount={props.requirementsPendingCount}
            payoutNotice={props.payoutNotice}
          />
        </div>
      );

    case "pos-menu":
      return (
        <div className="space-y-6" data-settings-section="pos-menu">
          <p className="text-sm text-oo-stone-gray leading-relaxed">
            Your Open Order location ID is what you paste into Deliverect as{" "}
            <strong className="font-medium text-oo-charcoal">channelLocationId</strong>. The Deliverect channel link ID
            is applied automatically when registration succeeds.
          </p>

          <VendorPosConnectionPanel
            vendorId={vendorId}
            vendorName={props.vendorName}
            deliverectChannelLinkId={props.deliverectChannelLinkId}
            deliverectLocationId={props.deliverectLocationId}
            posConnectionStatus={props.posConnectionStatus}
            pendingDeliverectConnectionKey={props.pendingDeliverectConnectionKey}
            deliverectAutoMapLastOutcome={props.deliverectAutoMapLastOutcome}
            deliverectAutoMapLastAt={props.deliverectAutoMapLastAt}
            hasUnmatchedChannelRegistration={props.hasUnmatchedChannelRegistration}
          />

          <MennyuLocationIdField mennyuLocationId={vendorId} />

          <div className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-5 shadow-sm">
            <h4 className="text-base font-semibold text-oo-charcoal">Menu publishing</h4>
            <p className="mt-1 text-sm text-oo-stone-gray">
              When auto-publish is off, review menu imports before they go live on Open Order.
            </p>
            <div className="mt-4">
              <VendorAutoPublishToggle vendorId={vendorId} initialAutoPublishMenus={props.autoPublishMenus} />
            </div>
          </div>

          {props.deliverectMenuIntegrity ? (
            <DeliverectMenuHealthPanel report={props.deliverectMenuIntegrity} title="Kitchen POS mapping health" />
          ) : null}

          <div className="flex flex-wrap gap-3 text-sm">
            <Link
              href={`/vendor/${vendorId}/menu`}
              className="font-medium text-oo-charcoal underline decoration-stone-300 underline-offset-2 hover:decoration-stone-600"
            >
              Review menu
            </Link>
            <Link
              href={`/vendor/${vendorId}/connect-pos`}
              className="font-medium text-oo-charcoal underline decoration-stone-300 underline-offset-2 hover:decoration-stone-600"
            >
              Manage POS connection
            </Link>
          </div>
        </div>
      );

    case "ordering":
      return (
        <div className="space-y-4" data-settings-section="ordering">
          <p className="text-sm text-oo-stone-gray">
            Pause and resume orders from the{" "}
            <Link href={`/vendor/${vendorId}/hours`} className="font-medium text-oo-charcoal underline">
              Hours
            </Link>{" "}
            page — not from Settings.
          </p>
          <div className="flex flex-wrap gap-4 text-sm">
            <Link href={`/vendor/${vendorId}/hours`} className="font-medium text-oo-charcoal underline">
              Open Hours
            </Link>
            <Link href={`/vendor/${vendorId}/orders`} className="font-medium text-oo-charcoal underline">
              Go to Orders
            </Link>
          </div>
        </div>
      );

    case "pod-membership":
      return (
        <div className="space-y-6" data-settings-section="pod-membership">
          <VendorPodRequests
            vendorId={vendorId}
            requests={props.pendingPodRequests}
            currentPod={props.currentPod}
          />
          <VendorRecentPodRequests recentRequests={props.recentPodRequests} />
          {props.currentPod ? (
            <p className="text-sm text-oo-stone-gray">
              View your pod at{" "}
              <Link href={`/pod/${props.currentPod.id}/dashboard`} className="font-medium text-oo-charcoal underline">
                {props.currentPod.name}
              </Link>
              .
            </p>
          ) : null}
        </div>
      );

    case "account":
      return (
        <div data-settings-section="account">
          <VendorDashboardAccessCard
            vendorId={vendorId}
            hasDashboardSecret={props.hasDashboardSecret}
            userEmail={props.userEmail}
            isPlatformAdmin={props.isPlatformAdmin}
          />
        </div>
      );

    default:
      return null;
  }
}
