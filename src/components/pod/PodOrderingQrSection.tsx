import QRCode from "qrcode";

import { buildPodOrderingAbsoluteUrl } from "@/lib/pod-ordering-url";

import { PodQrActions } from "./PodQrActions";

const QR_RENDER_PX = 400;

type PodOrderingQrSectionProps = {
  podId: string;
  podSlug: string;
  podName: string;
  /** From {@link getPublicSiteOrigin} or {@link getPublicSiteOriginFromEnv} */
  publicOrigin: string;
};

export async function PodOrderingQrSection({
  podId,
  podSlug,
  podName,
  publicOrigin,
}: PodOrderingQrSectionProps) {
  const absoluteUrl = buildPodOrderingAbsoluteUrl(publicOrigin, podId);
  const safeSlug = podSlug.replace(/[^a-zA-Z0-9-_]+/g, "-").slice(0, 48) || "pod";

  let qrDataUrl: string;
  try {
    qrDataUrl = await QRCode.toDataURL(absoluteUrl, {
      width: QR_RENDER_PX,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#1c1917ff", light: "#ffffffff" },
    });
  } catch {
    qrDataUrl = "";
  }

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Ordering link &amp; QR</h2>
      <p className="mt-1 text-sm text-stone-600">
        Customers can scan this code at the pod to start ordering. It links directly to this pod&apos;s
        ordering page.
      </p>
      <p className="mt-3 break-all font-mono text-xs text-stone-700">{absoluteUrl}</p>
      <p className="mt-1 text-xs text-stone-500">
        Set <code className="rounded bg-stone-100 px-1">PUBLIC_APP_URL</code> or{" "}
        <code className="rounded bg-stone-100 px-1">NEXT_PUBLIC_APP_URL</code> in production so this matches
        your live domain (otherwise the request host is used).
      </p>

      {qrDataUrl ? (
        <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="shrink-0 rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL from server */}
            <img
              src={qrDataUrl}
              alt={`QR code — order at ${podName}`}
              width={200}
              height={200}
              className="h-auto w-[200px] max-w-full"
            />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <p className="text-sm text-stone-600">
              Preview is scaled for the screen. Downloaded PNG is {QR_RENDER_PX}px — suitable for printing
              or scaling for signage.
            </p>
            <PodQrActions
              absoluteUrl={absoluteUrl}
              qrDataUrl={qrDataUrl}
              downloadFileName={`mennyu-pod-${safeSlug}-qr.png`}
            />
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-amber-800">Could not generate QR code. Try again or copy the link.</p>
      )}
    </section>
  );
}
