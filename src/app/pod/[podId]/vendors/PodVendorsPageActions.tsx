"use client";

import { useEffect, useState } from "react";
import { buttonClassName } from "@/components/ui/button";
import type { PendingEmailInvite } from "../dashboard/PodDashboardPendingEmailInvites";
import { PodInviteVendorsModal } from "./PodInviteVendorsModal";

type PodVendorsPageActionsProps = {
  podId: string;
  pendingEmailInvites: PendingEmailInvite[];
};

export function PodVendorsPageActions({ podId, pendingEmailInvites }: PodVendorsPageActionsProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#invite") return;
    setOpen(true);
    const path = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(null, "", path);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClassName({ variant: "primary", size: "md", className: "w-full sm:w-auto" })}
      >
        Invite vendors
      </button>
      <PodInviteVendorsModal
        open={open}
        onClose={() => setOpen(false)}
        podId={podId}
        pendingEmailInvites={pendingEmailInvites}
      />
    </>
  );
}
