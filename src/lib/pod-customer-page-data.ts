import "server-only";

import { auth } from "@/auth";
import { buildLoginHrefWithReturn } from "@/lib/auth/login-return-path";
import type { PodContactInfo } from "@/components/pod/PodPageContactSection";
import type { PodVendorGridRow } from "@/components/pod/PodVendorGrid";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { parsePodAmenities, parsePodCustomAmenities, type PodAmenityId } from "@/lib/pod-amenities";
import { getPublicPodAnnouncementText } from "@/lib/pod-announcement";
import { buildPodPageNavItems } from "@/lib/pod-page-nav";
import { getPodOrderingStatus } from "@/lib/pod-page-status";
import {
  resolveVendorHoursTimezone,
  vendorAvailabilityWithCustomerOrderingHours,
} from "@/lib/vendor-customer-ordering-hours";
import { buildVendorHoursDisplay, type VendorHoursDisplayModel } from "@/lib/vendor-hours-display";
import { loadVendorMenuReadinessSummaries } from "@/lib/vendor-menu-readiness.server";
import {
  getVendorCustomerPodCardAvailability,
  getVendorPublicVisibilityState,
  type VendorMenuReadinessSummary,
  type VendorPosReadinessSummary,
  type VendorStripeReadinessSummary,
} from "@/lib/vendor-readiness-states";

function toGridRow(
  pv: {
    isActive: boolean;
    isFeatured: boolean;
    vendor: {
      id: string;
      slug: string;
      name: string;
      description: string | null;
      imageUrl: string | null;
      cuisineCategory: string | null;
      isActive: boolean;
      mennyuOrdersPaused: boolean;
      customerOrderingHours: unknown;
      deliverectChannelLinkId: string | null;
      posConnectionStatus: VendorPosReadinessSummary["posConnectionStatus"];
      deliverectAutoMapLastOutcome: string | null;
      pendingDeliverectConnectionKey: string | null;
      stripeConnectedAccountId: string | null;
      stripeChargesEnabled: boolean;
      stripePayoutsEnabled: boolean;
    };
  },
  pod: { isActive: boolean; mennyuOrdersPaused: boolean; pickupTimezone: string | null },
  menuSummary: VendorMenuReadinessSummary,
  stripeSummary: VendorStripeReadinessSummary,
  posSummary: VendorPosReadinessSummary
): PodVendorGridRow | null {
  const hoursTimezone = resolveVendorHoursTimezone(pod.pickupTimezone);
  const vendorAvailability = vendorAvailabilityWithCustomerOrderingHours(
    {
      ...pv.vendor,
      syncCustomerOrderingHoursFromDeliverect: false,
      deliverectSyncedCustomerOrderingHours: null,
    },
    pod.pickupTimezone
  );

  const evaluation = {
    vendor: {
      isActive: pv.vendor.isActive,
      mennyuOrdersPaused: pv.vendor.mennyuOrdersPaused,
      name: pv.vendor.name,
      slug: pv.vendor.slug,
      description: pv.vendor.description,
      imageUrl: pv.vendor.imageUrl,
      cuisineCategory: pv.vendor.cuisineCategory,
      customerOrderingHours: pv.vendor.customerOrderingHours,
    },
    menuSummary,
    stripeSummary,
    posSummary,
    pod: { isActive: pod.isActive, mennyuOrdersPaused: pod.mennyuOrdersPaused },
    podVendor: { exists: true, isActive: pv.isActive },
    vendorAvailability,
  };

  if (getVendorPublicVisibilityState(evaluation) === "hidden") {
    return null;
  }

  const hoursDisplay: VendorHoursDisplayModel = buildVendorHoursDisplay({
    customerOrderingHours: pv.vendor.customerOrderingHours,
    timeZone: hoursTimezone,
  });

  return {
    vendor: {
      id: pv.vendor.id,
      slug: pv.vendor.slug,
      name: pv.vendor.name,
      description: pv.vendor.description,
      imageUrl: pv.vendor.imageUrl,
      cuisineCategory: pv.vendor.cuisineCategory,
    },
    isFeatured: pv.isFeatured,
    availability: getVendorCustomerPodCardAvailability(evaluation),
    hoursDisplay,
  };
}

export type PodCustomerPagePod = {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  address: string | null;
  imageUrl: string | null;
  accentColor: string | null;
  pickupInstructions: string | null;
  contactEmail: string | null;
  ownerContactPhone: string | null;
  ownerContactName: string | null;
  websiteUrl: string | null;
  instagramUrl: string | null;
};

export type PodCustomerPageData = {
  pod: PodCustomerPagePod;
  /** Active plain-text announcement for public banner; null when inactive or empty. */
  activeAnnouncement: string | null;
  vendorRows: PodVendorGridRow[];
  amenities: PodAmenityId[];
  customAmenities: string[];
  orderingStatus: ReturnType<typeof getPodOrderingStatus>;
  hasLocationSection: boolean;
  hasContactSection: boolean;
  hasAboutSection: boolean;
  hasVisitSection: boolean;
  contactDetails: PodContactInfo;
  groupOrderHref: string;
  navItems: ReturnType<typeof buildPodPageNavItems>;
};

export async function loadPodCustomerPageData(podId: string): Promise<PodCustomerPageData | null> {
  const [pod, session] = await Promise.all([
    prisma.pod.findUnique({
      where: { id: podId },
      include: {
        vendors: {
          where: { isActive: true, vendor: { isActive: true } },
          include: {
            vendor: {
              select: {
                id: true,
                slug: true,
                name: true,
                description: true,
                isActive: true,
                mennyuOrdersPaused: true,
                imageUrl: true,
                cuisineCategory: true,
                customerOrderingHours: true,
                deliverectChannelLinkId: true,
                posConnectionStatus: true,
                deliverectAutoMapLastOutcome: true,
                pendingDeliverectConnectionKey: true,
                stripeConnectedAccountId: true,
                stripeChargesEnabled: true,
                stripePayoutsEnabled: true,
              },
            },
          },
          orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }, { vendorId: "asc" }],
        },
      },
    }),
    auth(),
  ]);

  if (!pod || !pod.isActive) return null;

  const vendorIds = pod.vendors.map((pv) => pv.vendor.id);
  const menuSummaries = await loadVendorMenuReadinessSummaries(vendorIds);
  const stripeConnectConfigured = Boolean(env.STRIPE_SECRET_KEY);

  const vendorRows = pod.vendors
    .map((pv) => {
      const menuSummary = menuSummaries.get(pv.vendor.id) ?? {
        hasPublishedMenuVersion: false,
        hasOperationalItems: false,
        hasAvailableOperationalItems: false,
      };
      return toGridRow(
        pv,
        { isActive: pod.isActive, mennyuOrdersPaused: pod.mennyuOrdersPaused, pickupTimezone: pod.pickupTimezone },
        menuSummary,
        {
          stripeConnectedAccountId: pv.vendor.stripeConnectedAccountId,
          stripeChargesEnabled: pv.vendor.stripeChargesEnabled ?? false,
          stripePayoutsEnabled: pv.vendor.stripePayoutsEnabled ?? false,
          stripeConnectConfigured,
        },
        {
          deliverectChannelLinkId: pv.vendor.deliverectChannelLinkId,
          posConnectionStatus: pv.vendor.posConnectionStatus,
          deliverectAutoMapLastOutcome: pv.vendor.deliverectAutoMapLastOutcome,
          pendingDeliverectConnectionKey: pv.vendor.pendingDeliverectConnectionKey,
          hasUnmatchedChannelRegistration: false,
        }
      );
    })
    .filter((row): row is PodVendorGridRow => row != null);
  const amenities = parsePodAmenities(pod.amenities);
  const customAmenities = parsePodCustomAmenities(pod.customAmenities);
  const orderingStatus = pod.mennyuOrdersPaused
    ? {
        label: "Pod ordering paused",
        tone: "closed" as const,
        openVendorCount: 0,
        totalVendorCount: vendorRows.length,
      }
    : getPodOrderingStatus(vendorRows.map((r) => r.availability));

  const hasLocationSection = Boolean(pod.address?.trim());
  const hasContactSection = Boolean(
    pod.contactEmail?.trim() ||
      pod.ownerContactPhone?.trim() ||
      pod.websiteUrl?.trim() ||
      pod.instagramUrl?.trim()
  );
  const hasAboutSection = Boolean(
    pod.description?.trim() ||
      pod.tagline?.trim() ||
      pod.ownerContactName?.trim() ||
      amenities.length > 0 ||
      customAmenities.length > 0
  );
  const hasVisitSection = hasLocationSection || hasContactSection || Boolean(pod.pickupInstructions?.trim());

  const contactDetails: PodContactInfo = {
    contactEmail: pod.contactEmail,
    contactPhone: pod.ownerContactPhone,
    websiteUrl: pod.websiteUrl,
    instagramUrl: pod.instagramUrl,
  };

  const groupOrderCartUrl = `/cart?startGroupOrder=1&podId=${encodeURIComponent(podId)}`;
  const groupOrderHref = session?.user
    ? groupOrderCartUrl
    : buildLoginHrefWithReturn(groupOrderCartUrl);

  const navItems = buildPodPageNavItems({
    hasAboutSection,
    hasLocationSection,
    hasContactSection,
  });

  return {
    pod: {
      id: pod.id,
      name: pod.name,
      slug: pod.slug,
      tagline: pod.tagline,
      description: pod.description,
      address: pod.address,
      imageUrl: pod.imageUrl,
      accentColor: pod.accentColor,
      pickupInstructions: pod.pickupInstructions,
      contactEmail: pod.contactEmail,
      ownerContactPhone: pod.ownerContactPhone,
      ownerContactName: pod.ownerContactName,
      websiteUrl: pod.websiteUrl,
      instagramUrl: pod.instagramUrl,
    },
    activeAnnouncement: getPublicPodAnnouncementText(
      pod.announcementText,
      pod.announcementIsActive
    ),
    vendorRows,
    amenities,
    customAmenities,
    orderingStatus,
    hasLocationSection,
    hasContactSection,
    hasAboutSection,
    hasVisitSection,
    contactDetails,
    groupOrderHref,
    navItems,
  };
}
