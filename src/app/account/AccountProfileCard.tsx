"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { updateAccountNameAction } from "./actions";
import { accountHubCardClass, accountHubMutedClass, accountHubSectionTitleClass } from "./account-hub-styles";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type AccountProfileCardProps = {
  email: string;
  name: string | null;
};

export function AccountProfileCard({ email, name: initialName }: AccountProfileCardProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName ?? "");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function saveName() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const result = await updateAccountNameAction(name);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={accountHubCardClass}>
      <h2 className={accountHubSectionTitleClass}>Profile</h2>
      <p className={`mt-1 ${accountHubMutedClass}`}>Your sign-in identity for Open Order.</p>

      <dl className="mt-5 space-y-4 text-sm">
        <div>
          <dt className="text-oo-stone-gray">Display name</dt>
          {editing ? (
            <dd className="mt-1.5 space-y-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                autoComplete="name"
                className="oo-input max-w-md"
                placeholder="Your name"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveName()}
                  className={cn(buttonClassName({ variant: "primary", size: "sm" }))}
                >
                  {saving ? "Saving…" : "Save name"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setName(initialName ?? "");
                    setEditing(false);
                    setError(null);
                  }}
                  className={cn(buttonClassName({ variant: "secondary", size: "sm" }))}
                >
                  Cancel
                </button>
              </div>
            </dd>
          ) : (
            <dd className="mt-1 flex flex-wrap items-center gap-3">
              <span className="font-medium text-oo-charcoal">
                {initialName?.trim() ? initialName : "Not set"}
              </span>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-sm font-semibold text-brand underline-offset-4 hover:underline"
              >
                {initialName?.trim() ? "Edit" : "Add name"}
              </button>
            </dd>
          )}
        </div>
        <div>
          <dt className="text-oo-stone-gray">Email</dt>
          <dd className="mt-1 font-medium text-oo-charcoal">{email}</dd>
          <dd className="mt-1 text-xs text-oo-stone-gray">
            Email sign-in cannot be changed here. Contact support if you need help.
          </dd>
        </div>
      </dl>

      {saved && (
        <p className="mt-3 text-sm font-medium text-emerald-700" role="status">
          Profile updated.
        </p>
      )}
      {error && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
