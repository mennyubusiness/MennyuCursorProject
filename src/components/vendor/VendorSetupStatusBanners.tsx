import {
  VENDOR_HIDDEN_FROM_POD_BODY,
  VENDOR_HIDDEN_FROM_POD_TITLE,
  VENDOR_ORDERING_CLOSED_BODY,
  VENDOR_ORDERING_CLOSED_TITLE,
} from "@/lib/vendor-operational-copy";

export function VendorSetupStatusBanners({
  publicProfileReady,
  canAcceptOrders,
}: {
  publicProfileReady: boolean;
  canAcceptOrders: boolean;
}) {
  if (!publicProfileReady) {
    return (
      <div
        className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-950"
        role="status"
      >
        <p className="font-semibold">{VENDOR_HIDDEN_FROM_POD_TITLE}</p>
        <p className="mt-1">{VENDOR_HIDDEN_FROM_POD_BODY}</p>
      </div>
    );
  }

  if (!canAcceptOrders) {
    return (
      <div
        className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-950"
        role="status"
      >
        <p className="font-semibold">{VENDOR_ORDERING_CLOSED_TITLE}</p>
        <p className="mt-1">{VENDOR_ORDERING_CLOSED_BODY}</p>
      </div>
    );
  }

  return null;
}
