import Link from "next/link";
import { loadVendorMenuPageData } from "@/lib/vendor-menu-page-data.server";
import { VendorMenuHeaderActions } from "@/app/vendor/[vendorId]/menu/VendorMenuHeaderActions";
import { formatRelativeSyncTime } from "@/lib/vendor-menu-page.helpers";
import { VendorMenuImportsJobTable } from "./VendorMenuImportsJobTable";

export async function VendorDeliverectMenuImportsPanel({ vendorId }: { vendorId: string }) {
  const data = await loadVendorMenuPageData(vendorId);
  const autoPublish = data?.autoPublishMenus ?? false;

  return (
    <section className="space-y-6 rounded-xl border border-oo-light-stone bg-oo-warm-white p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-base font-semibold text-oo-charcoal">Deliverect</h3>
          <p className="mt-1 text-sm text-oo-stone-gray">
            Import and publish menu updates from Deliverect. When Deliverect sends a menu change, it
            appears below for review before going live on Open Order.
          </p>
        </div>
        {data ? (
          <VendorMenuHeaderActions
            vendorId={vendorId}
            canAdminPull={data.canAdminPull}
            latestImportJobId={data.latestImport?.jobId ?? null}
            canPublish={data.publishGate.canPublish}
          />
        ) : null}
      </div>

      {data ? (
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs text-oo-stone-gray">Connection</dt>
            <dd className="mt-0.5 font-medium text-oo-charcoal">
              {data.posConnected ? "POS connected" : "POS needs attention"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-oo-stone-gray">Last sync</dt>
            <dd className="mt-0.5 font-medium text-oo-charcoal">
              {data.publishedAtIso
                ? formatRelativeSyncTime(data.publishedAtIso)
                : data.latestImport?.importedAtIso
                  ? formatRelativeSyncTime(data.latestImport.importedAtIso)
                  : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-oo-stone-gray">Active items</dt>
            <dd className="mt-0.5 font-medium text-oo-charcoal">{data.liveSummary.availableCount}</dd>
          </div>
          <div>
            <dt className="text-xs text-oo-stone-gray">Menu health</dt>
            <dd className="mt-0.5 font-medium text-oo-charcoal">
              {data.menuHealth.ready ? "Ready" : "Needs attention"}
            </dd>
          </div>
        </dl>
      ) : null}

      {!data?.posConnected ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Deliverect is not fully connected.{" "}
          <Link href={`/vendor/${vendorId}/connect-pos`} className="font-medium underline">
            Connect Deliverect
          </Link>{" "}
          before importing menus.
        </p>
      ) : null}

      {autoPublish ? (
        <p className="rounded border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-950">
          <strong>Auto-publish</strong> is on for eligible webhook imports (no blocking issues).
        </p>
      ) : null}

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-oo-charcoal">Import history</h4>
          <Link
            href={`/vendor/${vendorId}/menu`}
            className="text-sm font-medium text-sky-800 hover:underline"
          >
            View live menu
          </Link>
        </div>
        <VendorMenuImportsJobTable vendorId={vendorId} />
      </div>
    </section>
  );
}
