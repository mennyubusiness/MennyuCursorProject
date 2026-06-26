import Link from "next/link";

import { PodAnnouncementBanner } from "@/components/pod/PodAnnouncementBanner";
import type { PodPromotionFeaturedVendor } from "./PodPromotionCard";

export function PodPromotePreviewSection({
  podId,
  publicPageHref,
  announcementText,
  announcementActive,
  featuredVendors,
}: {
  podId: string;
  publicPageHref: string;
  announcementText: string;
  announcementActive: boolean;
  featuredVendors: PodPromotionFeaturedVendor[];
}) {
  const previewText = announcementText.trim();
  const showAnnouncement = announcementActive && previewText.length > 0;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-oo-charcoal">Promote</h2>
          <p className="mt-1 text-sm text-oo-stone-gray">Share your public pod page and keep announcements fresh.</p>
        </div>
        <Link
          href={`/pod/${podId}/promote`}
          className="text-sm font-semibold text-oo-charcoal underline"
        >
          Open promote page
        </Link>
      </div>

      <div className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-4 text-sm">
        <p className="font-medium text-oo-charcoal">Public page</p>
        <p className="mt-1 break-all font-mono text-xs text-oo-stone-gray">{publicPageHref}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={`/pod/${podId}/promote`}
            className="rounded-lg border border-oo-light-stone bg-oo-cream px-3 py-1.5 text-sm font-medium text-oo-charcoal hover:bg-oo-warm-white"
          >
            Copy link & QR
          </Link>
          <Link
            href={publicPageHref}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-oo-light-stone bg-oo-cream px-3 py-1.5 text-sm font-medium text-oo-charcoal hover:bg-oo-warm-white"
          >
            View public page
          </Link>
          <Link
            href={`/pod/${podId}/promote#announcement`}
            className="rounded-lg border border-oo-light-stone bg-oo-cream px-3 py-1.5 text-sm font-medium text-oo-charcoal hover:bg-oo-warm-white"
          >
            Edit announcement
          </Link>
        </div>

        {showAnnouncement ? (
          <div className="mt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-oo-stone-gray">Announcement preview</p>
            <div className="mt-2">
              <PodAnnouncementBanner text={previewText} />
            </div>
          </div>
        ) : (
          <p className="mt-4 text-oo-stone-gray">No active announcement.</p>
        )}

        {featuredVendors.length > 0 ? (
          <div className="mt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-oo-stone-gray">Featured vendors</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {featuredVendors.map((vendor) => (
                <li
                  key={vendor.vendorId}
                  className="rounded-full bg-oo-cream px-3 py-1 text-xs font-medium text-oo-charcoal"
                >
                  {vendor.name}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
