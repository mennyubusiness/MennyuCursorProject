"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { StartGroupOrderButton } from "@/components/cart/StartGroupOrderButton";
import { useQuickCartOptional } from "@/components/cart/QuickCartContext";
import { JoinGroupOrderByCodeModal } from "@/components/group-order/JoinGroupOrderByCodeModal";
import { MobileBottomSheet } from "@/components/mobile/MobileBottomSheet";
import { ButtonLink, buttonClassName } from "@/components/ui/button";
import {
  isDestinationGroupPromptDismissed,
  markDestinationGroupPromptDismissed,
  shouldOpenDestinationGroupOrderPrompt,
} from "@/lib/destination-pod-group-prompt";
import { Z_DESTINATION_GROUP_PROMPT } from "@/lib/layout-z-index";
import { cn } from "@/lib/cn";

type DestinationPodGroupOrderPromptProps = {
  podId: string;
  isAuthenticated: boolean;
  groupOrderCartUrl: string;
  groupOrderHref: string;
};

export function DestinationPodGroupOrderPrompt({
  podId,
  isAuthenticated,
  groupOrderCartUrl,
  groupOrderHref,
}: DestinationPodGroupOrderPromptProps) {
  const router = useRouter();
  const quickCart = useQuickCartOptional();
  const [open, setOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const dismissPrompt = useCallback(() => {
    markDestinationGroupPromptDismissed(podId);
    setOpen(false);
  }, [podId]);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    const shouldOpen = shouldOpenDestinationGroupOrderPrompt({
      offerPrompt: true,
      dismissed: isDestinationGroupPromptDismissed(podId),
    });
    setOpen(shouldOpen);
  }, [hydrated, podId]);

  const handleStarted = useCallback(() => {
    markDestinationGroupPromptDismissed(podId);
    setOpen(false);
    quickCart?.openCart();
    router.refresh();
  }, [podId, quickCart, router]);

  const handleJoinOpen = useCallback(() => {
    markDestinationGroupPromptDismissed(podId);
    setOpen(false);
    setJoinOpen(true);
  }, [podId]);

  const primaryBtnClass = cn(
    buttonClassName({ variant: "primary", size: "touch" }),
    "w-full"
  );
  const secondaryBtnClass = cn(
    buttonClassName({ variant: "outline", size: "touch" }),
    "w-full"
  );
  const quietBtnClass = cn(
    buttonClassName({ variant: "ghost", size: "md" }),
    "w-full text-oo-stone-gray hover:text-oo-charcoal"
  );

  return (
    <>
      <MobileBottomSheet
        open={open}
        onClose={dismissPrompt}
        title="Ordering with friends?"
        description="Start a group order so everyone can add from different vendors, or join an existing order with a code."
        zIndex={Z_DESTINATION_GROUP_PROMPT}
        initialFocusSelector="#destination-group-order-start"
        panelClassName="bg-oo-cream/95"
        footer={
          <div className="border-t border-oo-light-stone bg-oo-warm-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-4 sm:px-5">
            <div className="flex flex-col gap-3">
              {isAuthenticated ? (
                <StartGroupOrderButton
                  id="destination-group-order-start"
                  podId={podId}
                  className={primaryBtnClass}
                  onStarted={handleStarted}
                />
              ) : (
                <ButtonLink
                  id="destination-group-order-start"
                  href={groupOrderHref}
                  variant="primary"
                  size="touch"
                  className={primaryBtnClass}
                  onClick={dismissPrompt}
                >
                  Start group order
                </ButtonLink>
              )}
              <button type="button" onClick={handleJoinOpen} className={secondaryBtnClass}>
                Join with code
              </button>
              <button type="button" onClick={dismissPrompt} className={quietBtnClass}>
                Continue browsing
              </button>
            </div>
          </div>
        }
      >
        <span className="sr-only">Group ordering options</span>
      </MobileBottomSheet>

      <JoinGroupOrderByCodeModal
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        zIndex={Z_DESTINATION_GROUP_PROMPT}
      />
    </>
  );
}
