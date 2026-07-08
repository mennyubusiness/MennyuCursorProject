import Link from "next/link";
import { VendorSquareCatalogImportControls } from "@/components/vendor/VendorSquareCatalogCard";
import { loadAdminSquareRoutingStatus } from "@/lib/integrations/square/square-routing-readiness";

export async function VendorSquareMenuImportsPanel({ vendorId }: { vendorId: string }) {
  const squareStatus = await loadAdminSquareRoutingStatus(vendorId);

  const canImport = squareStatus.isSelectable;
  const disabledReason = canImport
    ? null
    : squareStatus.missingRequirements[0] ??
      "Complete Square connection setup before importing your catalog.";

  return (
    <section className="space-y-4 rounded-xl border border-oo-light-stone bg-oo-warm-white p-5">
      <div>
        <h3 className="text-base font-semibold text-oo-charcoal">Square</h3>
        <p className="mt-1 text-sm text-oo-stone-gray">
          Preview or import your Square catalog into an unpublished draft menu. Publishing still
          happens from the review screen after import.
        </p>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-oo-stone-gray">Connection</dt>
          <dd className="mt-0.5 font-medium text-oo-charcoal">
            {squareStatus.hasConnection ? squareStatus.statusMessage : "Not connected"}
          </dd>
        </div>
        {squareStatus.businessName ? (
          <div>
            <dt className="text-xs text-oo-stone-gray">Business</dt>
            <dd className="mt-0.5 font-medium text-oo-charcoal">{squareStatus.businessName}</dd>
          </div>
        ) : null}
        {squareStatus.locationName ? (
          <div>
            <dt className="text-xs text-oo-stone-gray">Selected location</dt>
            <dd className="mt-0.5 font-medium text-oo-charcoal">{squareStatus.locationName}</dd>
          </div>
        ) : null}
      </dl>

      {!squareStatus.hasConnection ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Connect Square before importing a menu.{" "}
          <Link href={squareStatus.integrationUrl} className="font-medium underline">
            Open Square integration
          </Link>
        </p>
      ) : null}

      {squareStatus.hasConnection && !squareStatus.isSelectable ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Square is connected but not ready for catalog import.{" "}
          <Link href={squareStatus.integrationUrl} className="font-medium underline">
            Fix Square connection
          </Link>
        </p>
      ) : null}

      {squareStatus.hasConnection ? (
        <VendorSquareCatalogImportControls
          vendorId={vendorId}
          health={squareStatus.health}
          canImport={canImport}
          disabledReason={disabledReason}
        />
      ) : null}
    </section>
  );
}
