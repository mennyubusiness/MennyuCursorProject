"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { updatePodAnnouncement } from "@/actions/pod-settings.actions";
import { buildPodCustomerPath } from "@/lib/customer-public-url";
import { POD_ANNOUNCEMENT_MAX_LENGTH } from "@/lib/pod-announcement";
import { PodAnnouncementBanner } from "@/components/pod/PodAnnouncementBanner";

export type PodPromotionFeaturedVendor = {
  vendorId: string;
  name: string;
};

type PodPromotionCardProps = {
  podId: string;
  podSlug: string;
  initialText: string;
  initialIsActive: boolean;
  featuredVendors: PodPromotionFeaturedVendor[];
};

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function PodPromotionCard({
  podId,
  podSlug,
  initialText,
  initialIsActive,
  featuredVendors,
}: PodPromotionCardProps) {
  const router = useRouter();
  const fieldId = useId();
  const publicPodPath = buildPodCustomerPath(podSlug);
  const [text, setText] = useState(initialText);
  const [isActive, setIsActive] = useState(initialIsActive);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    setText(initialText);
    setIsActive(initialIsActive);
  }, [initialText, initialIsActive]);

  const previewText = text.trim();
  const showPreview = isActive && previewText.length > 0;
  const statusLabel =
    isActive && previewText.length > 0
      ? "Active on your public pod page"
      : previewText.length > 0
        ? "Saved as draft (not shown publicly)"
        : "No announcement";

  async function handleSave(nextActive = isActive) {
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const res = await updatePodAnnouncement(podId, { text, isActive: nextActive });
      if (!res.ok) {
        setError(res.error ?? "Could not save announcement");
        return;
      }
      setSuccess("Announcement saved.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    setText("");
    setIsActive(false);
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const res = await updatePodAnnouncement(podId, { text: "", isActive: false });
      if (!res.ok) {
        setError(res.error ?? "Could not clear announcement");
        return;
      }
      setSuccess("Announcement cleared.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleCopyPublicLink() {
    const absolute =
      typeof window !== "undefined" ? new URL(publicPodPath, window.location.origin).href : publicPodPath;
    const ok = await copyText(absolute);
    if (ok) {
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2000);
    }
  }

  return (
    <section className="rounded-xl border border-oo-light-stone bg-oo-cream/50 p-3 sm:p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-oo-stone-gray">Promote your pod</h2>
      <p className="mt-1 text-sm text-oo-stone-gray">
        Add a short message to your public pod page for events, new vendors, or special updates.
      </p>

      <div className="mt-4 rounded-lg border border-oo-light-stone bg-oo-warm-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-oo-charcoal">Pod announcement</p>
          <span className="text-xs text-oo-stone-gray">{statusLabel}</span>
        </div>

        <label htmlFor={fieldId} className="mt-3 block text-xs font-medium text-oo-stone-gray">
          Message
        </label>
        <textarea
          id={fieldId}
          value={text}
          onChange={(e) => {
            const next = e.target.value;
            setText(next);
            if (!next.trim()) setIsActive(false);
          }}
          maxLength={POD_ANNOUNCEMENT_MAX_LENGTH}
          rows={3}
          placeholder="Live music Friday 6–9 PM"
          className="mt-1 w-full break-words rounded-lg border border-oo-light-stone bg-oo-warm-white px-3 py-2 text-sm text-oo-charcoal"
        />
        <p className="mt-1 text-xs text-oo-stone-gray">
          {text.length}/{POD_ANNOUNCEMENT_MAX_LENGTH} characters · Plain text only
        </p>
        <ul className="mt-2 space-y-0.5 text-xs text-oo-stone-gray">
          <li>Example: Live music Friday 6–9 PM</li>
          <li>Example: New cart now open</li>
          <li>Example: Holiday hours updated</li>
        </ul>

        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-oo-charcoal">
          <input
            type="checkbox"
            checked={isActive}
            disabled={saving || text.trim().length === 0}
            onChange={(e) => setIsActive(e.target.checked)}
            className="rounded border-oo-light-stone"
          />
          Show on public pod page
        </label>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="rounded-lg bg-oo-charcoal px-4 py-2 text-sm font-medium text-white hover:bg-oo-charcoal/90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save announcement"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleClear()}
            className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-4 py-2 text-sm font-medium text-oo-charcoal hover:bg-oo-cream disabled:opacity-50"
          >
            Clear
          </button>
        </div>

        {error ? <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        {success ? <p className="mt-3 text-sm text-emerald-800">{success}</p> : null}
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">Public preview</p>
        {showPreview ? (
          <div className="mt-2 overflow-hidden rounded-xl border border-oo-light-stone">
            <PodAnnouncementBanner text={previewText} compact />
          </div>
        ) : (
          <p className="mt-2 text-sm text-oo-stone-gray">
            Turn on the announcement and add text to preview how it appears above your vendor list.
          </p>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-oo-light-stone bg-oo-warm-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">Featured vendors</p>
        {featuredVendors.length > 0 ? (
          <ul className="mt-2 space-y-1 text-sm text-oo-charcoal">
            {featuredVendors.map((vendor) => (
              <li key={vendor.vendorId} className="flex min-w-0 items-start gap-2">
                <span className="shrink-0 rounded-full border border-brand/25 bg-brand/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand">
                  Featured
                </span>
                <span className="min-w-0 break-words [overflow-wrap:anywhere]">{vendor.name}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-oo-stone-gray">
            Feature a vendor from the roster to highlight them on your public pod page.
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <Link
          href={publicPodPath}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-oo-charcoal underline hover:text-oo-charcoal"
        >
          View public pod page
        </Link>
        <button
          type="button"
          onClick={() => void handleCopyPublicLink()}
          className="font-medium text-oo-charcoal underline hover:text-oo-charcoal"
        >
          {copiedLink ? "Link copied!" : "Copy public page link"}
        </button>
        <Link
          href={`/pod/${podId}/settings#ordering-qr`}
          className="font-medium text-oo-charcoal underline hover:text-oo-charcoal"
        >
          QR &amp; signage
        </Link>
      </div>
    </section>
  );
}
