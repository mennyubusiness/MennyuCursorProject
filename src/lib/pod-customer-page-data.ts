import "server-only";

import { auth } from "@/auth";
import { buildLoginHrefWithReturn } from "@/lib/auth/login-return-path";
import type { PodContactInfo } from "@/components/pod/PodPageContactSection";
import type { PodVendorGridRow } from "@/components/pod/PodVendorGrid";
import { prisma } from "@/lib/db";
import { parsePodAmenities, parsePodCustomAmenities, type PodAmenityId } from "@/lib/pod-amenities";
import { buildPodPageNavItems } from "@/lib/pod-page-nav";
import { getPodOrderingStatus } from "@/lib/pod-page-status";
import { getVendorAvailabilityStatus } from "@/lib/vendor-availability";

function availabilityForVendor(v: {
  isActive: boolean;
  mennyuOrdersPaused: boolean;
}): PodVendorGridRow["availability"] {
  const status = getVendorAvailabilityStatus(v);
  const unavailable = status !== "open";
  const isPosClosed = status === "closed";
  const isMennyuNotAccepting = status === "mennyu_paused";
  const isInactive = status === "inactive";
  const statusLabel = isPosClosed
    ? "Closed"
    : isMennyuNotAccepting
      ? "Not accepting orders"
      : isInactive
        ? "Unavailable"
        : "Open for orders";

  return {
    unavailable,
    statusLabel,
    showBrowseHint: isMennyuNotAccepting || isPosClosed,
  };
}

function toGridRow(pv: {
  isFeatured: boolean;
  vendor: {
    id: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    cuisineCategory: string | null;
    isActive: boolean;
    mennyuOrdersPaused: boolean;
  };
}): PodVendorGridRow {
  return {
    vendor: {
      id: pv.vendor.id,
      name: pv.vendor.name,
      description: pv.vendor.description,
      imageUrl: pv.vendor.imageUrl,
      cuisineCategory: pv.vendor.cuisineCategory,
    },
    isFeatured: pv.isFeatured,
    availability: availabilityForVendor(pv.vendor),
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
          where: { isActive: true },
          include: {
            vendor: {
              select: {
                id: true,
                name: true,
                description: true,
                isActive: true,
                mennyuOrdersPaused: true,
                imageUrl: true,
                cuisineCategory: true,
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

  const vendorRows = pod.vendors.map(toGridRow);
  const amenities = parsePodAmenities(pod.amenities);
  const customAmenities = parsePodCustomAmenities(pod.customAmenities);
  const orderingStatus = getPodOrderingStatus(vendorRows.map((r) => r.availability));

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
