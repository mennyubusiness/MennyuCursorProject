"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type InviteFormState = {
  invitedVendorName: string;
  invitedEmail: string;
};

const EMPTY_FORM: InviteFormState = {
  invitedVendorName: "",
  invitedEmail: "",
};

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function PodInviteNewVendorForm({ podId }: { podId: string }) {
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
        body: JSON.stringify({
          invitedEmail: form.invitedEmail,
          invitedVendorName: form.invitedVendorName.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; inviteUrl?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not send invite.");
        return;
      }
      setForm(EMPTY_FORM);
      setLastInviteUrl(data.inviteUrl ?? null);
      setSuccess(
        "Invite sent. When the vendor creates an account, they'll be added to this pod."
      );
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
      {success ? (
        <div className="space-y-2 rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <p>{success}</p>
          {lastInviteUrl ? (
            <button
              type="button"
              onClick={() => void handleCopyLink()}
              className="text-sm font-medium text-emerald-900 underline hover:no-underline"
            >
              {copied ? "Link copied!" : "Copy invite link"}
            </button>
          ) : null}
        </div>
      ) : null}

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
        <span className="font-medium text-oo-charcoal">Vendor name (optional)</span>
        <input
          value={form.invitedVendorName}
          onChange={(e) => setForm((f) => ({ ...f, invitedVendorName: e.target.value }))}
          className="mt-1 w-full rounded border border-oo-light-stone px-3 py-2 text-oo-charcoal focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30"
        />
      </label>

      <button
        type="submit"
        disabled={loading}
        className="rounded bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
      >
        {loading ? "Sending…" : "Send invite"}
      </button>
    </form>
  );
}
