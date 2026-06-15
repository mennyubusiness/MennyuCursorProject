"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MobileBottomActionBar } from "@/components/mobile/MobileBottomActionBar";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/cn";

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
        "transition-transform duration-200 lg:hidden",
        visible ? "translate-y-0" : "pointer-events-none translate-y-full"
      )}
      role="region"
      aria-label={`Quick actions for ${podName}`}
    >
      <MobileBottomActionBar
        mobileOnly
        primaryLabel={showVendorsCta ? "View vendors" : "Start group order"}
        primaryHref={showVendorsCta ? "#pod-vendors" : groupOrderHref}
        secondaryAction={
          showVendorsCta && showGroupOrderCta ? (
            <Link
              href={groupOrderHref}
              className={cn(
                buttonClassName({ variant: "outline", size: "md" }),
                "min-h-11 shrink-0 px-3 text-sm sm:px-4"
              )}
            >
              Group
            </Link>
          ) : undefined
        }
      />
    </div>
  );
}
