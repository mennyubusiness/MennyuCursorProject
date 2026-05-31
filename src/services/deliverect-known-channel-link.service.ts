/**
 * Resolve Deliverect channel links configured in Open Order (Vendor.deliverectChannelLinkId).
 * Used to gate webhook HMAC verification — never trust a channelLinkId from the payload alone.
 */
import "server-only";

import { prisma } from "@/lib/db";

export type KnownDeliverectChannelLink = {
  vendorId: string;
  channelLinkId: string;
  isActive: boolean;
};

export async function getKnownDeliverectChannelLink(
  channelLinkId: string | null | undefined
): Promise<KnownDeliverectChannelLink | null> {
  const trimmed = channelLinkId?.trim();
  if (!trimmed) return null;

  const vendor = await prisma.vendor.findFirst({
    where: { deliverectChannelLinkId: trimmed },
    select: {
      id: true,
      isActive: true,
      deliverectChannelLinkId: true,
    },
  });

  if (!vendor?.deliverectChannelLinkId?.trim()) return null;

  return {
    vendorId: vendor.id,
    channelLinkId: vendor.deliverectChannelLinkId.trim(),
    isActive: vendor.isActive,
  };
}
