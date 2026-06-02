import Link from "next/link";
import { buildLoginHrefWithReturn } from "@/lib/auth/login-return-path";
import { VendorDashboardTokenForm } from "./VendorDashboardTokenForm";

/**
 * Platform admins only: temporary links, API key, manual session bind.
 * Visually secondary to normal settings — not part of the routine vendor experience.
 */
export function VendorAdminAccessToolsCard({
  vendorId,
  hasDashboardSecret,
}: {
  vendorId: string;
  hasDashboardSecret: boolean;
}) {
  const vendorUrl = `/vendor/${vendorId}`;
  const loginHref = buildLoginHrefWithReturn(vendorUrl);

  return (
    <div className="space-y-4 rounded-xl border border-dashed border-oo-light-stone bg-oo-cream/80 p-5 text-sm text-oo-stone-gray">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">Open Order admin · technical</p>
        <h4 className="mt-1 text-base font-semibold text-oo-charcoal">Access, onboarding &amp; automation</h4>
        <p className="mt-1 text-xs text-oo-stone-gray">
          For support and integrations. Routine restaurant staff use email sign-in and team membership — not these tools.
        </p>
      </div>

      <div className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-3 py-3 text-xs text-oo-stone-gray">
        <p className="font-medium text-oo-charcoal">Temporary access links</p>
        <p className="mt-1.5 leading-relaxed">
          You can issue a <strong>secure, time-limited link</strong> for onboarding before someone has a login. It binds
          this browser for a period; it does not replace normal sign-in.{" "}
          <Link href={loginHref} className="font-medium text-sky-800 underline">
            Vendor sign-in (for testing)
          </Link>
        </p>
      </div>

      <details className="rounded-lg border border-oo-light-stone bg-oo-warm-white">
        <summary className="cursor-pointer px-3 py-2.5 text-xs font-semibold text-oo-charcoal">
          Automation &amp; API access
        </summary>
        <div className="space-y-3 border-t border-oo-light-stone px-3 pb-3 pt-2 text-xs text-oo-charcoal leading-relaxed">
          <p>
            For <strong>integrations and server-to-server calls</strong>, this vendor may have an{" "}
            <strong>API access key</strong>. Use it as an{" "}
            <code className="rounded bg-oo-cream px-1 py-0.5 font-mono text-[11px]">Authorization: Bearer</code> header
            on vendor APIs. Not the POS password.
          </p>
          {hasDashboardSecret ? (
            <details className="rounded-md border border-oo-light-stone bg-oo-cream/80">
              <summary className="cursor-pointer px-3 py-2 text-[11px] font-medium text-oo-stone-gray">
                Bind API key in this browser (edge case)
              </summary>
              <div className="border-t border-oo-light-stone px-3 pb-3 pt-1">
                <p className="mb-2 text-[11px] text-oo-stone-gray">
                  Rarely needed — for diagnostics or when a key must be attached to this browser session manually.
                </p>
                <VendorDashboardTokenForm vendorId={vendorId} />
              </div>
            </details>
          ) : (
            <p className="rounded-md border border-oo-light-stone bg-oo-cream/80 px-3 py-2 text-oo-charcoal">
              No API access key is configured for this vendor. Issue one through your internal admin processes when
              automation is required.
            </p>
          )}
        </div>
      </details>
    </div>
  );
}
