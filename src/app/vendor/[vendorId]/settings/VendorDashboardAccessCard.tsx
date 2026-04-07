import Link from "next/link";
import { VendorDashboardTokenForm } from "./VendorDashboardTokenForm";

/**
 * Human access: NextAuth + VendorMembership first. Secondary: admin-issued temporary link + automation/API key
 * (see docs/AUTH_UNIFIED.md). Backend `vendorDashboardToken` unchanged.
 */
export function VendorDashboardAccessCard({
  vendorId,
  hasDashboardSecret,
}: {
  vendorId: string;
  hasDashboardSecret: boolean;
}) {
  const vendorUrl = `/vendor/${vendorId}`;
  const loginHref = `/login?intent=vendor&callbackUrl=${encodeURIComponent(vendorUrl)}`;

  return (
    <div className="space-y-5 rounded-xl border border-stone-200 bg-white p-5 shadow-sm text-sm text-stone-600">
      <div className="space-y-2">
        <h4 className="text-base font-semibold text-stone-900">
          Sign in with your account to manage your business
        </h4>
        <p>
          <Link href={loginHref} className="font-medium text-sky-800 underline">
            Sign in
          </Link>{" "}
          with the email and password for your restaurant team. Access is tied to your Mennyu user and vendor
          membership — this is the normal way to use the dashboard.
        </p>
        <p>
          New team?{" "}
          <Link href="/register" className="font-medium text-sky-800 underline">
            Create a Mennyu account
          </Link>{" "}
          and choose <strong>Vendor</strong> during setup.
        </p>
      </div>

      <div className="rounded-lg border border-stone-200 bg-stone-50/90 px-3 py-3 text-xs text-stone-600">
        <p className="font-medium text-stone-800">Temporary access link</p>
        <p className="mt-1.5 leading-relaxed">
          Your Mennyu administrator can send a <strong>secure, time-limited link</strong> that opens access in this
          browser — useful for onboarding before everyone has logins. This is <strong>not</strong> a replacement for
          signing in; it only binds this device for a period using the same browser session automation uses behind the
          scenes.
        </p>
      </div>

      <details className="rounded-lg border border-stone-200 bg-stone-50/50">
        <summary className="cursor-pointer px-3 py-2.5 text-xs font-semibold text-stone-800">
          Automation &amp; API access
        </summary>
        <div className="space-y-3 border-t border-stone-200 px-3 pb-3 pt-2 text-xs text-stone-700 leading-relaxed">
          <p>
            For <strong>integrations, scripts, and server-to-server calls</strong>, Mennyu issues an{" "}
            <strong>API access key</strong> on this vendor. Use it as an{" "}
            <code className="rounded bg-white px-1 py-0.5 font-mono text-[11px]">Authorization: Bearer</code> header on
            vendor APIs. It is not your restaurant POS password.
          </p>
          {hasDashboardSecret ? (
            <details className="rounded-md border border-stone-200 bg-white">
              <summary className="cursor-pointer px-3 py-2 text-[11px] font-medium text-stone-600">
                Technical: bind API access key in this browser
              </summary>
              <div className="border-t border-stone-100 px-3 pb-3 pt-1">
                <p className="mb-2 text-[11px] text-stone-500">
                  Rarely needed — only if an administrator gave you the key and you must attach it to this browser
                  session manually. Prefer <strong>Sign in</strong> or a <strong>temporary access link</strong> above.
                </p>
                <VendorDashboardTokenForm vendorId={vendorId} />
              </div>
            </details>
          ) : (
            <p className="rounded-md border border-stone-200 bg-white px-3 py-2 text-stone-700">
              No API access key is configured for this vendor. Your Mennyu administrator can generate one for
              automation when needed.
            </p>
          )}
        </div>
      </details>
    </div>
  );
}
