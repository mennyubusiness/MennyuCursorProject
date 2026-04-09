"use client";

import { useCallback, useId, useState } from "react";
import { isHttpsImageUrl } from "@/lib/remote-image-url";
import { MAX_BRAND_IMAGE_BYTES } from "@/lib/image-upload-constants";

const ACCEPT = "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp";

type Props = {
  scope: "pod" | "vendor";
  entityId: string;
  value: string;
  onChange: (next: string) => void;
  /** Accessible label fragment e.g. "Pod logo" / "Business logo" */
  label: string;
};

export function BrandLogoUploadField({ scope, entityId, value, onChange, label }: Props) {
  const inputId = useId();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showUrl, setShowUrl] = useState(false);

  const uploadFile = useCallback(
    async (file: File) => {
      setUploadError(null);
      if (file.size > MAX_BRAND_IMAGE_BYTES) {
        setUploadError(`File must be at most ${MAX_BRAND_IMAGE_BYTES / 1024 / 1024}MB.`);
        return;
      }
      setUploading(true);
      try {
        const fd = new FormData();
        fd.set("scope", scope);
        fd.set("entityId", entityId);
        fd.set("file", file);
        if (value.trim()) {
          fd.set("previousUrl", value.trim());
        }
        const res = await fetch("/api/upload/brand-image", {
          method: "POST",
          body: fd,
          credentials: "same-origin",
        });
        const data = (await res.json()) as { ok?: boolean; url?: string; error?: string };
        if (!res.ok || !data.ok || !data.url) {
          setUploadError(data.error ?? "Upload failed.");
          return;
        }
        onChange(data.url);
      } catch {
        setUploadError("Network error. Try again.");
      } finally {
        setUploading(false);
      }
    },
    [scope, entityId, value, onChange]
  );

  const previewSrc = value.trim() && isHttpsImageUrl(value.trim()) ? value.trim() : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start gap-4">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-stone-200 bg-stone-100">
          {previewSrc ? (
            // eslint-disable-next-line @next/next/no-img-element -- preview supports any https host (CDN, Supabase, etc.)
            <img src={previewSrc} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-stone-400">No logo</div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <label htmlFor={inputId} className="block text-sm font-medium text-stone-800">
            {label}
          </label>
          <p className="text-xs text-stone-500">
            PNG, JPEG, or WebP — up to {MAX_BRAND_IMAGE_BYTES / 1024 / 1024}MB. Uses secure upload when
            storage is configured.
          </p>
          <input
            id={inputId}
            type="file"
            accept={ACCEPT}
            disabled={uploading}
            className="block w-full max-w-md text-sm text-stone-800 file:mr-3 file:rounded-md file:border-0 file:bg-stone-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-stone-800 hover:file:bg-stone-200 disabled:opacity-50"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void uploadFile(f);
            }}
          />
          {uploading && <p className="text-sm text-stone-600">Uploading…</p>}
          {uploadError && (
            <p className="text-sm text-red-600" role="alert">
              {uploadError}
            </p>
          )}
          {previewSrc && (
            <button
              type="button"
              disabled={uploading}
              onClick={() => onChange("")}
              className="text-sm font-medium text-stone-600 underline hover:text-stone-900 disabled:opacity-50"
            >
              Remove logo
            </button>
          )}
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowUrl((s) => !s)}
          className="text-sm font-medium text-stone-600 underline hover:text-stone-900"
        >
          {showUrl ? "Hide image URL option" : "Or paste an image URL instead"}
        </button>
        {showUrl && (
          <div className="mt-2">
            <label htmlFor={`${inputId}-url`} className="sr-only">
              Image URL
            </label>
            <input
              id={`${inputId}-url`}
              type="url"
              inputMode="url"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="https://…"
              disabled={uploading}
              className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-mono text-stone-900 shadow-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-400 disabled:opacity-50"
            />
            <p className="mt-1 text-xs text-stone-500">Must be a direct https:// link to an image.</p>
          </div>
        )}
      </div>
    </div>
  );
}
