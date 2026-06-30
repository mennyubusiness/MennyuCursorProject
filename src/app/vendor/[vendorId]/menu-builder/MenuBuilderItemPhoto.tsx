"use client";

import { useCallback, useId, useRef, useState } from "react";
import { MenuItemImage } from "@/components/images/MenuItemImage";
import { MAX_BRAND_IMAGE_BYTES } from "@/lib/image-upload-constants";
import { isHttpsImageUrl } from "@/lib/remote-image-url";

const ACCEPT = "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp";

type MenuBuilderItemPhotoProps = {
  vendorId: string;
  itemId: string;
  itemName: string;
  imageUrl: string | null;
  disabled?: boolean;
  onImageChange: (nextUrl: string | null) => void;
  status?: "idle" | "saving" | "saved" | "error";
  error?: string | null;
};

export function MenuBuilderItemPhoto({
  vendorId,
  itemId,
  itemName,
  imageUrl,
  disabled,
  onImageChange,
  status,
  error,
}: MenuBuilderItemPhotoProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const hasPhoto = Boolean(imageUrl && isHttpsImageUrl(imageUrl));

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
        fd.set("vendorId", vendorId);
        fd.set("menuItemId", itemId);
        fd.set("file", file);
        if (imageUrl?.trim()) {
          fd.set("previousUrl", imageUrl.trim());
        }
        const res = await fetch("/api/upload/menu-item-image", {
          method: "POST",
          body: fd,
          credentials: "same-origin",
        });
        const data = (await res.json()) as { ok?: boolean; url?: string; error?: string };
        if (!res.ok || !data.ok || !data.url) {
          setUploadError(data.error ?? "Upload failed.");
          return;
        }
        onImageChange(data.url);
      } catch {
        setUploadError("Network error. Try again.");
      } finally {
        setUploading(false);
      }
    },
    [vendorId, itemId, imageUrl, onImageChange]
  );

  const busy = disabled || uploading || status === "saving";

  return (
    <div className="flex shrink-0 flex-col gap-1.5">
      <MenuItemImage
        imageUrl={imageUrl}
        itemName={itemName}
        className="h-20 w-20 sm:h-24 sm:w-24"
        sizes="96px"
      />
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ACCEPT}
        disabled={busy}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void uploadFile(f);
        }}
      />
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="rounded-md border border-oo-light-stone bg-white px-2 py-1 text-xs font-medium text-oo-charcoal hover:bg-oo-cream disabled:opacity-50"
        >
          {uploading ? "Uploading…" : hasPhoto ? "Change" : "Add photo"}
        </button>
        {hasPhoto ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onImageChange(null)}
            className="rounded-md px-2 py-1 text-xs font-medium text-red-700 hover:underline disabled:opacity-50"
          >
            Remove
          </button>
        ) : null}
      </div>
      {uploadError ? (
        <p className="max-w-[6.5rem] text-xs text-red-700" role="alert">
          {uploadError}
        </p>
      ) : null}
      {error ? <p className="max-w-[6.5rem] text-xs text-red-700">{error}</p> : null}
      {status === "saving" ? (
        <p className="text-xs text-oo-stone-gray">Saving…</p>
      ) : null}
    </div>
  );
}
