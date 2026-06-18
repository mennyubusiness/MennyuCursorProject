"use client";

import { useState } from "react";

import { JoinGroupOrderByCodeModal } from "@/components/group-order/JoinGroupOrderByCodeModal";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type CartPageJoinGroupActionProps = {
  className?: string;
  /** Inline text link for empty states; collapsible panel when set to details. */
  variant?: "link" | "details";
};

/** Secondary entry to join a group order — never the primary cart action. */
export function CartPageJoinGroupAction({
  className,
  variant = "link",
}: CartPageJoinGroupActionProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {variant === "details" ? (
        <details
          className={cn(
            "rounded-xl border border-oo-light-stone bg-oo-cream/40 px-4 py-3 sm:px-5",
            className
          )}
        >
          <summary className="cursor-pointer text-sm font-semibold text-oo-charcoal">
            Join a group order
          </summary>
          <p className="mt-2 text-sm text-oo-stone-gray">
            Have a code from your host? Enter it to add your items to their group cart.
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={cn(buttonClassName({ variant: "outline", size: "sm" }), "mt-3")}
          >
            Enter group code
          </button>
        </details>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "text-sm font-semibold text-oo-stone-gray transition-colors hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
            className
          )}
        >
          Join a group order
        </button>
      )}

      <JoinGroupOrderByCodeModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
