import QRCode from "qrcode";

import { DashboardCard } from "@/components/dashboard";
import { DASHBOARD_SECTION_SCROLL_CLASS } from "@/components/dashboard/dashboard-styles";
import { buildPodOrderingAbsoluteUrl } from "@/lib/pod-ordering-url";
import { cn } from "@/lib/cn";

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
  podId: _podId,
  podSlug,
  podName,
  publicOrigin,
}: PodOrderingQrSectionProps) {
  const absoluteUrl = buildPodOrderingAbsoluteUrl(publicOrigin, podSlug);
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
    <section id="ordering-qr" className={cn(DASHBOARD_SECTION_SCROLL_CLASS)}>
      <DashboardCard
        title="QR & signage"
        description="Customers can scan this code at your pod to open your public pod page and start ordering."
      >
        <p className="break-all font-mono text-xs text-oo-stone-gray">{absoluteUrl}</p>
        <p className="mt-1 text-xs text-oo-stone-gray">
          Set <code className="rounded bg-oo-cream px-1">PUBLIC_APP_URL</code> or{" "}
          <code className="rounded bg-oo-cream px-1">NEXT_PUBLIC_APP_URL</code> in production so this
          matches your live domain (otherwise the request host is used).
        </p>

        {qrDataUrl ? (
          <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="shrink-0 rounded-xl border border-oo-light-stone bg-oo-warm-white p-3 shadow-sm">
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
              <p className="text-sm text-oo-stone-gray">
                Preview is scaled for the screen. Downloaded PNG is {QR_RENDER_PX}px — suitable for
                printing or scaling for signage.
              </p>
              <PodQrActions
                absoluteUrl={absoluteUrl}
                qrDataUrl={qrDataUrl}
                downloadFileName={`open-order-pod-${safeSlug}-qr.png`}
              />
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-amber-900">Could not generate QR code. Try again or copy the link.</p>
        )}
      </DashboardCard>
    </section>
  );
}
