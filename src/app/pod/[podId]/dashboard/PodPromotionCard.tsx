"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { updatePodAnnouncement } from "@/actions/pod-settings.actions";
import { DashboardCard } from "@/components/dashboard";
import { POD_ANNOUNCEMENT_MAX_LENGTH } from "@/lib/pod-announcement";
import { PodAnnouncementBanner } from "@/components/pod/PodAnnouncementBanner";

type PodPromotionCardProps = {
  podId: string;
  initialText: string;
  initialIsActive: boolean;
};

export function PodPromotionCard({ podId, initialText, initialIsActive }: PodPromotionCardProps) {
  const router = useRouter();
  const fieldId = useId();
  const [text, setText] = useState(initialText);
  const [isActive, setIsActive] = useState(initialIsActive);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
        : "No active announcement";

  async function handleSave() {
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const res = await updatePodAnnouncement(podId, { text, isActive });
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

  return (
    <DashboardCard
      title="Announcement"
      description="Show a short message on your public pod page."
      as="section"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-oo-stone-gray">{statusLabel}</span>
      </div>

      <label htmlFor={fieldId} className="mt-3 block text-sm font-medium text-oo-charcoal">
        Announcement text
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
        className="mt-1 w-full break-words rounded-lg border border-oo-light-stone bg-oo-warm-white px-3 py-2 text-sm text-oo-charcoal focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30"
      />
      <p className="mt-1 text-xs text-oo-stone-gray">
        {text.length}/{POD_ANNOUNCEMENT_MAX_LENGTH} characters
      </p>

      <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-oo-charcoal">
        <input
          type="checkbox"
          checked={isActive}
          disabled={saving || text.trim().length === 0}
          onChange={(e) => setIsActive(e.target.checked)}
          className="rounded border-oo-light-stone"
        />
        Show on public page
      </label>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
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

      <div className="mt-6 border-t border-oo-light-stone pt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-oo-stone-gray">Preview</p>
        {showPreview ? (
          <div className="mt-2 overflow-hidden rounded-xl border border-oo-light-stone">
            <PodAnnouncementBanner text={previewText} compact />
          </div>
        ) : (
          <p className="mt-2 text-sm text-oo-stone-gray">
            {previewText.length > 0
              ? "Turn on “Show on public page” to preview how it appears."
              : "No active announcement."}
          </p>
        )}
      </div>
    </DashboardCard>
  );
}
