"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateVendorBrandProfile } from "@/actions/vendor-dashboard.actions";
import { BrandLogoUploadField } from "@/components/uploads/BrandLogoUploadField";

const DEFAULT_PICKER_FALLBACK = "#2563eb";

export function VendorBrandProfileForm({
  vendorId,
  initialName,
  initialDescription,
  initialImageUrl,
  initialAccentColor,
  initialCuisineCategory,
}: {
  vendorId: string;
  initialName: string;
  initialDescription: string | null;
  initialImageUrl: string | null;
  initialAccentColor: string | null;
  initialCuisineCategory?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [cuisineCategory, setCuisineCategory] = useState(initialCuisineCategory ?? "");
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
        cuisineCategory,
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
        <label htmlFor="brand-name" className="block text-sm font-medium text-oo-charcoal">
          Vendor name
        </label>
        <input
          id="brand-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={200}
          required
          className="mt-1 w-full rounded-md border border-oo-light-stone bg-oo-warm-white px-3 py-2 text-sm text-oo-charcoal shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30"
        />
      </div>

      <div>
        <label htmlFor="brand-cuisine" className="block text-sm font-medium text-oo-charcoal">
          Cuisine/category
        </label>
        <p className="mt-0.5 text-xs text-oo-stone-gray">Helps customers find you on the pod page.</p>
        <input
          id="brand-cuisine"
          type="text"
          value={cuisineCategory}
          onChange={(e) => setCuisineCategory(e.target.value)}
          maxLength={120}
          className="mt-1 w-full rounded-md border border-oo-light-stone bg-oo-warm-white px-3 py-2 text-sm text-oo-charcoal shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30"
        />
      </div>

      <div>
        <label htmlFor="brand-description" className="block text-sm font-medium text-oo-charcoal">
          Description
        </label>
        <p className="mt-0.5 text-xs text-oo-stone-gray">Optional. Shown on the pod and your menu.</p>
        <textarea
          id="brand-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          rows={4}
          className="mt-1 w-full rounded-md border border-oo-light-stone bg-oo-warm-white px-3 py-2 text-sm text-oo-charcoal shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30"
        />
        <p className="mt-0.5 text-right text-xs text-oo-stone-gray">{description.length} / 2000</p>
      </div>

      <BrandLogoUploadField
        scope="vendor"
        entityId={vendorId}
        label="Logo / banner photo"
        value={imageUrl}
        onChange={setImageUrl}
      />

      <div className="rounded-md border border-oo-light-stone bg-oo-cream/80 p-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-oo-charcoal">
          <input
            type="checkbox"
            checked={useAccent}
            onChange={(e) => {
              setUseAccent(e.target.checked);
              if (e.target.checked && !/^#[0-9a-fA-F]{6}$/.test(accentHex)) {
                setAccentHex(initialAccentColor ?? DEFAULT_PICKER_FALLBACK);
              }
            }}
            className="rounded border-oo-light-stone"
          />
          Use custom accent color
        </label>
        <p className="mt-1 text-xs text-oo-stone-gray">Highlights on your pod card and menu.</p>
        {useAccent && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(accentHex) ? accentHex : DEFAULT_PICKER_FALLBACK}
              onChange={(e) => syncColorPickerToHex(e.target.value)}
              className="h-10 w-14 cursor-pointer rounded border border-oo-light-stone bg-oo-warm-white"
              aria-label="Pick accent color"
            />
            <input
              type="text"
              value={accentHex}
              onChange={(e) => setAccentHex(e.target.value)}
              placeholder="#2563eb"
              className="w-36 rounded-md border border-oo-light-stone bg-oo-warm-white px-2 py-2 font-mono text-sm text-oo-charcoal"
              aria-label="Accent color hex"
            />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save profile"}
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
