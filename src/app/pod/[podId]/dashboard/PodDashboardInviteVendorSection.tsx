"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PodDashboardVendorSearch } from "./PodDashboardVendorSearch";
import { PodDashboardPendingEmailInvites, type PendingEmailInvite } from "./PodDashboardPendingEmailInvites";

type InviteFormState = {
  invitedVendorName: string;
  invitedContactName: string;
  invitedEmail: string;
  invitedPhone: string;
  note: string;
};

const EMPTY_FORM: InviteFormState = {
  invitedVendorName: "",
  invitedContactName: "",
  invitedEmail: "",
  invitedPhone: "",
  note: "",
};

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function InviteByEmailForm({
  podId,
  compact,
  onSuccess,
}: {
  podId: string;
  compact?: boolean;
  onSuccess?: (inviteUrl: string) => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<InviteFormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/pod/${podId}/vendor-invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; inviteUrl?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not send invite.");
        return;
      }
      setForm(EMPTY_FORM);
      setLastInviteUrl(data.inviteUrl ?? null);
      setSuccess("Invite sent. The vendor can accept from their email.");
      onSuccess?.(data.inviteUrl ?? "");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyLink() {
    if (!lastInviteUrl) return;
    const ok = await copyText(lastInviteUrl);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
      {error ? <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {success ? <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{success}</p> : null}

      <div className={compact ? "grid gap-3 sm:grid-cols-2" : "space-y-3"}>
        <label className="block text-sm">
          <span className="font-medium text-oo-charcoal">Vendor / business name</span>
          <input
            required
            value={form.invitedVendorName}
            onChange={(e) => setForm((f) => ({ ...f, invitedVendorName: e.target.value }))}
            className="mt-1 w-full rounded border border-oo-light-stone px-3 py-2 text-oo-charcoal focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-oo-charcoal">Contact name (optional)</span>
          <input
            value={form.invitedContactName}
            onChange={(e) => setForm((f) => ({ ...f, invitedContactName: e.target.value }))}
            className="mt-1 w-full rounded border border-oo-light-stone px-3 py-2 text-oo-charcoal focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-oo-charcoal">Email</span>
          <input
            type="email"
            required
            value={form.invitedEmail}
            onChange={(e) => setForm((f) => ({ ...f, invitedEmail: e.target.value }))}
            className="mt-1 w-full rounded border border-oo-light-stone px-3 py-2 text-oo-charcoal focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-oo-charcoal">Phone (optional)</span>
          <input
            type="tel"
            value={form.invitedPhone}
            onChange={(e) => setForm((f) => ({ ...f, invitedPhone: e.target.value }))}
            className="mt-1 w-full rounded border border-oo-light-stone px-3 py-2 text-oo-charcoal focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30"
          />
        </label>
      </div>

      {!compact ? (
        <label className="block text-sm">
          <span className="font-medium text-oo-charcoal">Note (optional)</span>
          <textarea
            rows={2}
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            className="mt-1 w-full rounded border border-oo-light-stone px-3 py-2 text-oo-charcoal focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30"
          />
        </label>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
        >
          {loading ? "Sending…" : compact ? "Invite vendor" : "Invite by email"}
        </button>
        {lastInviteUrl ? (
          <button
            type="button"
            onClick={() => void handleCopyLink()}
            className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-3 py-2 text-sm font-medium text-oo-charcoal hover:bg-oo-cream"
          >
            {copied ? "Link copied!" : "Copy invite link"}
          </button>
        ) : null}
      </div>
    </form>
  );
}

export function PodDashboardInviteVendorSection({
  podId,
  podName,
  prominent = false,
  collapsedByDefault = false,
  pendingEmailInvites,
}: {
  podId: string;
  podName: string;
  prominent?: boolean;
  collapsedByDefault?: boolean;
  pendingEmailInvites: PendingEmailInvite[];
}) {
  const [showExpandedForm, setShowExpandedForm] = useState(!collapsedByDefault);
  const [showSearch, setShowSearch] = useState(false);

  if (prominent) {
    return (
      <section className="rounded-xl border border-oo-charcoal/15 bg-oo-cream/80 p-6">
        <h2 className="text-lg font-semibold text-oo-charcoal">Invite your first vendor</h2>
        <p className="mt-2 text-sm text-oo-stone-gray">
          Start by inviting the food carts that operate at {podName}. Vendors can accept the invite,
          connect Stripe, finish setup, and appear in your pod once ready.
        </p>

        <div className="mt-5">
          <InviteByEmailForm podId={podId} />
        </div>

        <PodDashboardPendingEmailInvites podId={podId} invites={pendingEmailInvites} className="mt-5" />

        <details className="mt-5 rounded-lg border border-oo-light-stone bg-oo-warm-white p-3">
          <summary className="cursor-pointer text-sm font-medium text-oo-charcoal">
            Already on Open Order?
          </summary>
          <div className="mt-3">
            <PodDashboardVendorSearch podId={podId} />
          </div>
        </details>
      </section>
    );
  }

  const body = (
    <>
      <p className="text-sm text-oo-stone-gray">
        Invite a new vendor to join this pod or share your pod invite link after sending an email invite.
      </p>

      {showExpandedForm ? (
        <div className="mt-3">
          <InviteByEmailForm podId={podId} compact />
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowExpandedForm(true)}
            className="rounded bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
          >
            Invite vendor
          </button>
        </div>
      )}

      <PodDashboardPendingEmailInvites podId={podId} invites={pendingEmailInvites} className="mt-4" />

      <details
        className="mt-4 rounded-lg border border-oo-light-stone bg-oo-cream/40 p-3"
        open={showSearch}
        onToggle={(e) => setShowSearch((e.target as HTMLDetailsElement).open)}
      >
        <summary className="cursor-pointer text-sm font-medium text-oo-charcoal">
          Search existing vendors
        </summary>
        <div className="mt-3">
          <PodDashboardVendorSearch podId={podId} />
        </div>
      </details>
    </>
  );

  if (collapsedByDefault && !showExpandedForm && pendingEmailInvites.length === 0) {
    return (
      <details className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-4">
        <summary className="cursor-pointer list-none text-sm font-semibold uppercase tracking-wide text-oo-stone-gray [&::-webkit-details-marker]:hidden">
          Add another vendor
        </summary>
        <div className="mt-3">{body}</div>
      </details>
    );
  }

  return (
    <section className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-oo-stone-gray">Add another vendor</h2>
      <div className="mt-3">{body}</div>
    </section>
  );
}
