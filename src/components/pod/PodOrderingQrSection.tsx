import QRCode from "qrcode";

import { DashboardCard } from "@/components/dashboard";
import { DASHBOARD_SECTION_SCROLL_CLASS } from "@/components/dashboard/dashboard-styles";
import { buildPodCustomerPath } from "@/lib/customer-public-url";
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
  const slug = podSlug.trim();
  const publicPageHref = slug ? buildPodCustomerPath(slug) : "";
  const origin = publicOrigin.replace(/\/$/, "");
  const publicPageUrl = slug && origin ? `${origin}${publicPageHref}` : "";
  const safeSlug = slug.replace(/[^a-zA-Z0-9-_]+/g, "-").slice(0, 48) || "pod";

  let qrDataUrl = "";
  if (slug && origin) {
    const qrTargetUrl = buildPodOrderingAbsoluteUrl(origin, slug);
    try {
      qrDataUrl = await QRCode.toDataURL(qrTargetUrl, {
        width: QR_RENDER_PX,
        margin: 2,
        errorCorrectionLevel: "M",
        color: { dark: "#1c1917ff", light: "#ffffffff" },
      });
    } catch {
      qrDataUrl = "";
    }
  }

  return (
    <section id="share-your-pod" className={cn(DASHBOARD_SECTION_SCROLL_CLASS)}>
      <DashboardCard
        title="Share your pod"
        description="Use your public link or QR code to help customers start an order."
      >
        {!publicPageHref ? (
          <p className="text-sm text-oo-stone-gray">Public page link is not available yet.</p>
        ) : (
          <div className="space-y-5">
            <div className="rounded-lg border border-oo-light-stone bg-oo-cream/40 px-3 py-2.5">
              <p className="text-xs font-medium uppercase tracking-wide text-oo-stone-gray">Public page</p>
              <p className="mt-1 break-all text-sm font-medium text-oo-charcoal">{publicPageHref}</p>
              {publicPageUrl ? (
                <p className="mt-1 break-all text-xs text-oo-stone-gray">{publicPageUrl}</p>
              ) : null}
            </div>

            {qrDataUrl ? (
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                <div className="mx-auto shrink-0 rounded-xl border border-oo-light-stone bg-oo-warm-white p-3 shadow-sm sm:mx-0">
                  {/* eslint-disable-next-line @next/next/no-img-element -- data URL from server */}
                  <img
                    src={qrDataUrl}
                    alt={`QR code for ${podName}`}
                    width={200}
                    height={200}
                    className="h-auto w-[200px] max-w-full"
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-3">
                  <PodQrActions
                    publicPageUrl={publicPageUrl}
                    publicPageHref={publicPageHref}
                    qrDataUrl={qrDataUrl}
                    downloadFileName={`open-order-pod-${safeSlug}-qr.png`}
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-oo-stone-gray">QR code is not available yet.</p>
            )}
          </div>
        )}
      </DashboardCard>
    </section>
  );
}
