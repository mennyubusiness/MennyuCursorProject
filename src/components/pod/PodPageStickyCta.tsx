"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { buttonClassName } from "@/components/ui/button";

type PodPageStickyCtaProps = {
  podName: string;
  showVendorsCta: boolean;
  showGroupOrderCta: boolean;
  groupOrderHref: string;
};

export function PodPageStickyCta({
  podName,
  showVendorsCta,
  showGroupOrderCta,
  groupOrderHref,
}: PodPageStickyCtaProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("pod-hero");
    if (!hero) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { rootMargin: "-72px 0px 0px 0px", threshold: 0 }
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  if (!showVendorsCta && !showGroupOrderCta) return null;

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-oo-light-stone bg-oo-warm-white/95 p-3 shadow-[0_-8px_24px_rgba(31,31,28,0.12)] backdrop-blur-md transition-transform duration-200 lg:hidden",
        visible ? "translate-y-0" : "translate-y-full pointer-events-none"
      )}
      role="region"
      aria-label={`Quick actions for ${podName}`}
    >
      <div className="oo-shell flex gap-2">
        {showVendorsCta && (
          <a
            href="#pod-vendors"
            className={cn(buttonClassName({ variant: "primary", size: "sm" }), "min-h-10 flex-1")}
          >
            View vendors
          </a>
        )}
        {showGroupOrderCta && (
          <Link
            href={groupOrderHref}
            className={cn(
              buttonClassName({ variant: showVendorsCta ? "outline" : "primary", size: "sm" }),
              "min-h-10 shrink-0",
              showVendorsCta ? "px-3" : "flex-1"
            )}
          >
            {showVendorsCta ? "Group order" : "Start group order"}
          </Link>
        )}
      </div>
    </div>
  );
}
