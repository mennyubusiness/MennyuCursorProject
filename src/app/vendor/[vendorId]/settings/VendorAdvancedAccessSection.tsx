import { VendorDashboardTokenForm } from "./VendorDashboardTokenForm";

/**
 * Legacy/automation paths: manual token → dashboard cookie. Primary access is email sign-in.
 */
export function VendorAdvancedAccessSection({
  vendorId,
  hasDashboardToken,
}: {
  vendorId: string;
  hasDashboardToken: boolean;
}) {
  return (
    <details className="rounded-lg border border-stone-200 bg-white">
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-stone-800">
        Advanced access
      </summary>
      <div className="space-y-4 border-t border-stone-100 px-4 py-4 text-sm text-stone-600">
        <p>
          Most teams use <strong>email sign-in</strong> at the top of this page. Use this section only if your
          administrator asked you to paste a <strong>dashboard token</strong> (for a browser session) or you rely on
          integrations that use the legacy cookie.
        </p>
        {hasDashboardToken ? (
          <VendorDashboardTokenForm vendorId={vendorId} />
        ) : (
          <p className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-stone-700">
            No dashboard token is set for this location. If you need one for automation or a special setup, contact
            your Mennyu administrator.
          </p>
        )}
      </div>
    </details>
  );
}
