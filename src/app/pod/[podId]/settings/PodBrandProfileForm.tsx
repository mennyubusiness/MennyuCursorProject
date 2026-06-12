"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updatePodBrandProfile } from "@/actions/pod-settings.actions";
import { BrandLogoUploadField } from "@/components/uploads/BrandLogoUploadField";
import { POD_AMENITY_OPTIONS, type PodAmenityId } from "@/lib/pod-amenities";

const DEFAULT_PICKER_FALLBACK = "#2563eb";

const inputClass =
  "mt-1 w-full rounded-md border border-oo-light-stone bg-oo-warm-white px-3 py-2 text-sm text-oo-charcoal shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30";

export function PodBrandProfileForm({
  podId,
  initialName,
  initialTagline,
  initialDescription,
  initialImageUrl,
  initialAccentColor,
  initialAddress,
  initialContactEmail,
  initialContactPhone,
  initialWebsiteUrl,
  initialInstagramUrl,
  initialPickupInstructions,
  initialAmenities,
}: {
  podId: string;
  initialName: string;
  initialTagline: string | null;
  initialDescription: string | null;
  initialImageUrl: string | null;
  initialAccentColor: string | null;
  initialAddress: string | null;
  initialContactEmail: string | null;
  initialContactPhone: string | null;
  initialWebsiteUrl: string | null;
  initialInstagramUrl: string | null;
  initialPickupInstructions: string | null;
  initialAmenities: PodAmenityId[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(initialName);
  const [tagline, setTagline] = useState(initialTagline ?? "");
  const [description, setDescription] = useState(initialDescription ?? "");
  const [imageUrl, setImageUrl] = useState(initialImageUrl ?? "");
  const [useAccent, setUseAccent] = useState(Boolean(initialAccentColor));
  const [accentHex, setAccentHex] = useState(initialAccentColor ?? DEFAULT_PICKER_FALLBACK);
  const [address, setAddress] = useState(initialAddress ?? "");
  const [contactEmail, setContactEmail] = useState(initialContactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(initialContactPhone ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(initialWebsiteUrl ?? "");
  const [instagramUrl, setInstagramUrl] = useState(initialInstagramUrl ?? "");
  const [pickupInstructions, setPickupInstructions] = useState(initialPickupInstructions ?? "");
  const [amenities, setAmenities] = useState<PodAmenityId[]>(initialAmenities);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  function syncColorPickerToHex(hex: string) {
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) setAccentHex(hex);
  }

  function toggleAmenity(id: PodAmenityId) {
    setAmenities((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const res = await updatePodBrandProfile(podId, {
        name,
        tagline,
        description,
        imageUrl,
        accentColor: useAccent ? accentHex : "",
        address,
        contactEmail,
        contactPhone,
        websiteUrl,
        instagramUrl,
        pickupInstructions,
        amenities,
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
    <form onSubmit={onSubmit} className="space-y-8">
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-oo-charcoal">Brand</h3>
        <div>
          <label htmlFor="pod-brand-name" className="block text-sm font-medium text-oo-charcoal">
            Pod name
          </label>
          <input
            id="pod-brand-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
            required
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="pod-brand-tagline" className="block text-sm font-medium text-oo-charcoal">
            Tagline
          </label>
          <p className="mt-0.5 text-xs text-oo-stone-gray">
            Short hero line on the pod page. Optional — a default is used if blank.
          </p>
          <input
            id="pod-brand-tagline"
            type="text"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            maxLength={240}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="pod-brand-description" className="block text-sm font-medium text-oo-charcoal">
            About
          </label>
          <p className="mt-0.5 text-xs text-oo-stone-gray">
            Longer description for the About section. Optional.
          </p>
          <textarea
            id="pod-brand-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            rows={4}
            className={inputClass}
          />
          <p className="mt-0.5 text-right text-xs text-oo-stone-gray">{description.length} / 2000</p>
        </div>

        <BrandLogoUploadField
          scope="pod"
          entityId={podId}
          label="Pod banner / logo image"
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
          <p className="mt-1 text-xs text-oo-stone-gray">
            Subtle hero tint on the pod page — not a full theme.
          </p>
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
      </div>

      <div className="space-y-4 border-t border-oo-light-stone pt-6">
        <h3 className="text-sm font-semibold text-oo-charcoal">Contact &amp; location</h3>
        <div>
          <label htmlFor="pod-address" className="block text-sm font-medium text-oo-charcoal">
            Address
          </label>
          <textarea
            id="pod-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            maxLength={500}
            rows={2}
            className={inputClass}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pod-contact-email" className="block text-sm font-medium text-oo-charcoal">
              Contact email
            </label>
            <input
              id="pod-contact-email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="pod-contact-phone" className="block text-sm font-medium text-oo-charcoal">
              Contact phone
            </label>
            <input
              id="pod-contact-phone"
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              maxLength={40}
              className={inputClass}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pod-website" className="block text-sm font-medium text-oo-charcoal">
              Website
            </label>
            <input
              id="pod-website"
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="pod-instagram" className="block text-sm font-medium text-oo-charcoal">
              Instagram
            </label>
            <input
              id="pod-instagram"
              type="text"
              value={instagramUrl}
              onChange={(e) => setInstagramUrl(e.target.value)}
              placeholder="@yourpod or https://instagram.com/…"
              className={inputClass}
            />
          </div>
        </div>
        <div>
          <label htmlFor="pod-pickup" className="block text-sm font-medium text-oo-charcoal">
            Pickup instructions
          </label>
          <textarea
            id="pod-pickup"
            value={pickupInstructions}
            onChange={(e) => setPickupInstructions(e.target.value)}
            maxLength={2000}
            rows={3}
            className={inputClass}
          />
        </div>
      </div>

      <div className="space-y-3 border-t border-oo-light-stone pt-6">
        <h3 className="text-sm font-semibold text-oo-charcoal">Amenities</h3>
        <p className="text-xs text-oo-stone-gray">Shown as chips on the public pod page when selected.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {POD_AMENITY_OPTIONS.map(({ id, label }) => (
            <label key={id} className="flex cursor-pointer items-center gap-2 text-sm text-oo-charcoal">
              <input
                type="checkbox"
                checked={amenities.includes(id)}
                onChange={() => toggleAmenity(id)}
                className="rounded border-oo-light-stone"
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-oo-light-stone pt-6">
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
