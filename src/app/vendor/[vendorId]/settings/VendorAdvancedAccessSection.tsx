import { VendorDashboardTokenForm } from "./VendorDashboardTokenForm";

/**
 * Token / automation access — intended to sit inside the page-level "Advanced" disclosure.
 * Primary access remains email sign-in (see VendorDashboardAccessCard).
 */
export function VendorAdvancedAccessSection({
  vendorId,
  hasDashboardToken,
}: {
  vendorId: string;
  hasDashboardToken: boolean;
}) {
  return (
    <div className="space-y-4 text-sm text-stone-600">
      <p>
        For automation or admin-provided access tokens only. Prefer the secure link from your administrator when
        possible.
      </p>
      {hasDashboardToken ? (
        <VendorDashboardTokenForm vendorId={vendorId} />
      ) : (
        <p className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-stone-700">
          No token is configured. Ask your Mennyu administrator if you need one.
        </p>
      )}
    </div>
  );
}
