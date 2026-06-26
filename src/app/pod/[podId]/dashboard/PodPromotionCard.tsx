"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
import { updatePodAnnouncement } from "@/actions/pod-settings.actions";
import { DashboardCard } from "@/components/dashboard";
import { DASHBOARD_STATUS_TONE_CLASS } from "@/components/dashboard/dashboard-styles";
import { POD_ANNOUNCEMENT_MAX_LENGTH } from "@/lib/pod-announcement";
import { PodAnnouncementBanner } from "@/components/pod/PodAnnouncementBanner";
import { cn } from "@/lib/cn";

type PodPromotionCardProps = {
  podId: string;
  initialText: string;
  initialIsActive: boolean;
};

type AnnouncementStatus = "active" | "hidden" | "empty";

const EXAMPLE_MESSAGES = [
  { label: "Live music tonight", text: "Live music tonight 6–9 PM" },
  { label: "New vendor now open", text: "New vendor now open" },
  { label: "Holiday hours updated", text: "Holiday hours updated" },
  { label: "Event this weekend", text: "Special event this weekend" },
] as const;

function deriveAnnouncementStatus(text: string, isActive: boolean): AnnouncementStatus {
  const trimmed = text.trim();
  if (!trimmed) return "empty";
  if (isActive) return "active";
  return "hidden";
}

function statusBadgeLabel(status: AnnouncementStatus): string {
  switch (status) {
    case "active":
      return "Active";
    case "hidden":
      return "Hidden";
    default:
      return "Empty";
  }
}

function statusBadgeTone(status: AnnouncementStatus): keyof typeof DASHBOARD_STATUS_TONE_CLASS {
  switch (status) {
    case "active":
      return "success";
    case "hidden":
      return "warning";
    default:
      return "neutral";
  }
}

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
  const status = useMemo(() => deriveAnnouncementStatus(text, isActive), [text, isActive]);
  const showLivePreview = previewText.length > 0 && isActive;

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

  function applyExample(message: string) {
    setText(message);
    if (!message.trim()) setIsActive(false);
  }

  return (
    <DashboardCard
      title="Announcement"
      description="Post a short update customers will see on your public pod page."
      actions={
        <span
          className={cn(
            "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
            DASHBOARD_STATUS_TONE_CLASS[statusBadgeTone(status)]
          )}
        >
          {statusBadgeLabel(status)}
        </span>
      }
      as="section"
    >
      <div className="rounded-xl border border-oo-light-stone bg-oo-cream/30 p-4 sm:p-5">
        <label htmlFor={fieldId} className="block text-sm font-medium text-oo-charcoal">
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
          rows={4}
          placeholder="Live music tonight 6–9 PM"
          className="mt-2 w-full break-words rounded-xl border border-oo-light-stone bg-oo-warm-white px-3 py-3 text-sm text-oo-charcoal shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30"
        />
        <p className="mt-2 text-xs text-oo-stone-gray">
          {text.length}/{POD_ANNOUNCEMENT_MAX_LENGTH} characters · Plain text only
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLE_MESSAGES.map((example) => (
            <button
              key={example.label}
              type="button"
              disabled={saving}
              onClick={() => applyExample(example.text)}
              className="rounded-full border border-oo-light-stone bg-oo-warm-white px-3 py-1.5 text-xs font-medium text-oo-charcoal transition hover:border-brand/30 hover:bg-oo-cream disabled:opacity-50"
            >
              {example.label}
            </button>
          ))}
        </div>

        <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-oo-charcoal">
          <input
            type="checkbox"
            checked={isActive}
            disabled={saving || previewText.length === 0}
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

      <div className="mt-6 border-t border-oo-light-stone pt-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-oo-stone-gray">Preview</p>
        <div className="mt-3">
          {showLivePreview ? (
            <PodAnnouncementBanner text={previewText} compact />
          ) : (
            <div className="rounded-xl border border-dashed border-oo-light-stone bg-oo-cream/40 px-4 py-8 text-center">
              <p className="text-sm text-oo-stone-gray">
                {previewText.length === 0
                  ? "Write an announcement to preview it."
                  : "This announcement is hidden from the public page."}
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardCard>
  );
}
