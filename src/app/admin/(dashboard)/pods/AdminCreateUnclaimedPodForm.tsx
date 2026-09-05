"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { adminCreateUnclaimedPodAction } from "@/actions/admin-pod.actions";

export function AdminCreateUnclaimedPodForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [ownerContactName, setOwnerContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [reason, setReason] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function create(allowDuplicate: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await adminCreateUnclaimedPodAction({
        name,
        address,
        ownerContactName,
        contactEmail,
        reason,
        allowDuplicate,
      });
      if (!result.ok) {
        setError(result.error);
        setDuplicateWarning(
          "duplicateWarning" in result && result.duplicateWarning ? result.error : null
        );
        return;
      }
      setDuplicateWarning(null);
      router.push(`/admin/pods/${result.pod.id}`);
      router.refresh();
    });
  }

  return (
    <form
      className="space-y-3 rounded-xl border border-dashed border-oo-light-stone bg-oo-warm-white p-4"
      onSubmit={(event) => {
        event.preventDefault();
        create(false);
      }}
    >
      <div>
        <h2 className="text-sm font-semibold text-oo-charcoal">Create pod</h2>
        <p className="mt-1 text-xs text-oo-stone-gray">
          Creates an unclaimed, menu-only pod. No owner account or payment setup is required.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          placeholder="Pod name"
          className="oo-input"
        />
        <input
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          placeholder="Address / location (optional)"
          className="oo-input"
        />
        <input
          value={ownerContactName}
          onChange={(event) => setOwnerContactName(event.target.value)}
          placeholder="Contact name (optional)"
          className="oo-input"
        />
        <input
          type="email"
          value={contactEmail}
          onChange={(event) => setContactEmail(event.target.value)}
          placeholder="Owner email (optional)"
          className="oo-input"
        />
      </div>
      <textarea
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        rows={2}
        required
        minLength={3}
        placeholder="Admin reason"
        className="oo-input"
      />
      {duplicateWarning ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
          <p>{duplicateWarning}</p>
          <button
            type="button"
            disabled={pending}
            onClick={() => create(true)}
            className="mt-2 font-semibold underline"
          >
            Create separate pod anyway
          </button>
        </div>
      ) : null}
      {error && !duplicateWarning ? (
        <p className="text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create unclaimed pod"}
      </button>
    </form>
  );
}
