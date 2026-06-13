export type AdminVendorDeliverectRow = {
  vendorId: string;
  name: string;
  slug: string;
  posConnectionStatus: string;
  pendingDeliverectConnectionKey: string | null;
  deliverectChannelLinkId: string | null;
  deliverectLocationId: string | null;
  deliverectAccountId: string | null;
  deliverectAccountEmail: string | null;
  deliverectAutoMapLastAt: string | null;
  deliverectAutoMapLastOutcome: string | null;
  deliverectAutoMapLastDetail: string | null;
  podName: string | null;
  menuSummary: {
    hasPublishedMenuVersion: boolean;
    hasAvailableOperationalItems: boolean;
  };
};

export type AdminChannelRegistrationRow = {
  id: string;
  createdAtIso: string;
  eventId: string | null;
  idempotencyKey: string | null;
  processed: boolean;
  errorMessage: string | null;
  channelLinkId: string | null;
  channelLocationId: string | null;
  locationId: string | null;
  status: string | null;
  channelLinkName: string | null;
  payloadKeys: string[];
  mappedVendor: { vendorId: string; vendorName: string } | null;
  likelyVendor: { vendorId: string; vendorName: string } | null;
};
