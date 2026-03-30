"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateVendorBrandProfile } from "@/actions/vendor-dashboard.actions";

const DEFAULT_PICKER_FALLBACK = "#2563eb";

export function VendorBrandProfileForm({
  vendorId,
  initialName,
  initialDescription,
  initialImageUrl,
  initialAccentColor,
}: {
  vendorId: string;
  initialName: string;
  initialDescription: string | null;
  initialImageUrl: string | null;
  initialAccentColor: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [imageUrl, setImageUrl] = useState(initialImageUrl ?? "");
  const [useAccent, setUseAccent] = useState(Boolean(initialAccentColor));
  const [accentHex, setAccentHex] = useState(initialAccentColor ?? DEFAULT_PICKER_FALLBACK);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  function syncColorPickerToHex(hex: string) {
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) setAccentHex(hex);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const res = await updateVendorBrandProfile(vendorId, {
        name,
        description,
        imageUrl,
        accentColor: useAccent ? accentHex : "",
      });
      if (!res.ok) {
        setMessage({ text: res.error ?? "Could not save", error: true });
        return;
      }
      setMessage({ text: "Saved.", error: false });
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="brand-name" className="block text-sm font-medium text-stone-800">
          Business name
        </label>
        <input
          id="brand-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={200}
          required
          className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-400"
        />
      </div>

      <div>
        <label htmlFor="brand-description" className="block text-sm font-medium text-stone-800">
          Description
        </label>
        <p className="mt-0.5 text-xs text-stone-500">Optional. Shown on the pod and your menu.</p>
        <textarea
          id="brand-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          rows={4}
          className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-400"
        />
        <p className="mt-0.5 text-right text-xs text-stone-400">{description.length} / 2000</p>
      </div>

      <div>
        <label htmlFor="brand-logo-url" className="block text-sm font-medium text-stone-800">
          Logo URL
        </label>
        <p className="mt-0.5 text-xs text-stone-500">
          Use an <strong>https</strong> image link. Leave blank to show initials instead.
        </p>
        <input
          id="brand-logo-url"
          type="url"
          inputMode="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://…"
          className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-mono text-stone-900 shadow-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-400"
        />
      </div>

      <div className="rounded-md border border-stone-200 bg-stone-50/80 p-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-stone-800">
          <input
            type="checkbox"
            checked={useAccent}
            onChange={(e) => {
              setUseAccent(e.target.checked);
              if (e.target.checked && !/^#[0-9a-fA-F]{6}$/.test(accentHex)) {
                setAccentHex(initialAccentColor ?? DEFAULT_PICKER_FALLBACK);
              }
            }}
            className="rounded border-stone-300"
          />
          Use custom accent color
        </label>
        <p className="mt-1 text-xs text-stone-500">Highlights on your pod card and menu.</p>
        {useAccent && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(accentHex) ? accentHex : DEFAULT_PICKER_FALLBACK}
              onChange={(e) => syncColorPickerToHex(e.target.value)}
              className="h-10 w-14 cursor-pointer rounded border border-stone-300 bg-white"
              aria-label="Pick accent color"
            />
            <input
              type="text"
              value={accentHex}
              onChange={(e) => setAccentHex(e.target.value)}
              placeholder="#2563eb"
              className="w-36 rounded-md border border-stone-300 bg-white px-2 py-2 font-mono text-sm text-stone-900"
              aria-label="Accent color hex"
            />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save brand"}
        </button>
        {message && (
          <span className={`text-sm ${message.error ? "text-red-600" : "text-emerald-800"}`} role="status">
            {message.text}
          </span>
        )}
      </div>
    </form>
  );
}
