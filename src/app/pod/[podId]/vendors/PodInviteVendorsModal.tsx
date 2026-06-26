"use client";

import { MobileBottomSheet } from "@/components/mobile/MobileBottomSheet";
import { buttonClassName } from "@/components/ui/button";
import {
  PodDashboardPendingEmailInvites,
  type PendingEmailInvite,
} from "../dashboard/PodDashboardPendingEmailInvites";
import { PodDashboardVendorSearch } from "../dashboard/PodDashboardVendorSearch";
import { PodInviteNewVendorForm } from "./PodInviteNewVendorForm";

type PodInviteVendorsModalProps = {
  open: boolean;
  onClose: () => void;
  podId: string;
  pendingEmailInvites: PendingEmailInvite[];
};

export function PodInviteVendorsModal({
  open,
  onClose,
  podId,
  pendingEmailInvites,
}: PodInviteVendorsModalProps) {
  return (
    <MobileBottomSheet
      open={open}
      onClose={onClose}
      title="Invite vendors"
      description="Add a vendor to this pod by inviting a new vendor or adding one already on Open Order."
      panelClassName="sm:max-w-2xl"
      initialFocusSelector='input[type="email"]'
      footer={
        <div className="border-t border-oo-light-stone px-4 py-3 sm:px-5">
          <button type="button" onClick={onClose} className={buttonClassName({ variant: "outline", size: "md", className: "w-full" })}>
            Close
          </button>
        </div>
      }
    >
      <div className="space-y-8">
        <section className="space-y-3">
          <div>
            <h3 className="text-base font-semibold text-oo-charcoal">Invite a new vendor</h3>
            <p className="mt-1 text-sm text-oo-stone-gray">
              Use this when the vendor does not have an Open Order account yet.
            </p>
          </div>
          <PodInviteNewVendorForm podId={podId} />
        </section>

        <section className="space-y-3 border-t border-oo-light-stone pt-8">
          <div>
            <h3 className="text-base font-semibold text-oo-charcoal">Add an existing vendor</h3>
            <p className="mt-1 text-sm text-oo-stone-gray">
              Use this when the vendor already has an Open Order account.
            </p>
          </div>
          <PodDashboardVendorSearch podId={podId} />
        </section>

        {pendingEmailInvites.length > 0 ? (
          <section className="border-t border-oo-light-stone pt-8">
            <PodDashboardPendingEmailInvites podId={podId} invites={pendingEmailInvites} />
          </section>
        ) : null}
      </div>
    </MobileBottomSheet>
  );
}
