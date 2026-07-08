"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { DashboardCard } from "@/components/dashboard";
import {
  importSquareCatalogAction,
  previewSquareCatalogAction,
} from "@/actions/vendor-square-catalog.actions";
import type { ProviderConnectionHealth } from "@/lib/integrations/types";
import type {
  SquareCatalogImportReport,
  SquareCatalogPreviewReport,
} from "@/lib/integrations/square/square-menu-import.service";

export function VendorSquareCatalogCard({
  vendorId,
  health,
  canImport,
  disabledReason,
}: {
  vendorId: string;
  health: ProviderConnectionHealth;
  canImport: boolean;
  disabledReason: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<SquareCatalogPreviewReport | null>(null);
  const [importReport, setImportReport] = useState<SquareCatalogImportReport | null>(null);

  return (
    <DashboardCard className="max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-oo-charcoal">Square catalog</h3>
          <p className="mt-1 text-xs text-oo-stone-gray">
            Preview or import Square catalog into an unpublished draft menu. Does not change your
            live menu until you publish from menu imports.
          </p>
        </div>
      </div>

      {!canImport ? (
        <div className="mt-4 space-y-2 text-sm text-amber-900">
          <p>{disabledReason ?? "Square connection must be healthy before catalog import."}</p>
          {health.missingRequirements.length > 0 ? (
            <ul className="list-inside list-disc text-xs">
              {health.missingRequirements.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending || !canImport}
          className="inline-flex items-center justify-center rounded-xl border border-oo-light-stone px-4 py-2.5 text-sm font-semibold text-oo-charcoal hover:bg-oo-cream disabled:opacity-60"
          onClick={() => {
            setError(null);
            setImportReport(null);
            startTransition(async () => {
              const result = await previewSquareCatalogAction(vendorId);
              if (!result.ok) {
                setError(result.error);
                setPreview(null);
                return;
              }
              setPreview(result.report);
            });
          }}
        >
          {pending ? "Loading…" : "Preview Square catalog"}
        </button>
        <button
          type="button"
          disabled={pending || !canImport}
          className="inline-flex items-center justify-center rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-hover disabled:opacity-60"
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await importSquareCatalogAction(vendorId);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setImportReport(result.report);
              setPreview(result.report);
            });
          }}
        >
          {pending ? "Importing…" : "Import Square catalog"}
        </button>
      </div>

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      {preview ? (
        <div className="mt-5 space-y-3 rounded-lg border border-oo-light-stone bg-oo-warm-white p-4 text-sm text-oo-charcoal">
          <p className="font-medium">Preview report</p>
          <p className="text-xs text-oo-stone-gray">
            Location: {preview.locationName ?? preview.locationId}
            {preview.squareEnvironment ? ` (${preview.squareEnvironment})` : ""}
          </p>
          <p className="text-xs text-oo-stone-gray">{preview.importStrategy}</p>
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            <li>Categories: {preview.stats.categories}</li>
            <li>Items/variations: {preview.stats.items}</li>
            <li>Modifier groups: {preview.stats.modifierGroups}</li>
            <li>Modifier options: {preview.stats.modifierOptions}</li>
            <li>Skipped: {preview.skipped.length}</li>
            <li>Warnings: {preview.warnings.length}</li>
          </ul>
          {preview.warnings.length > 0 ? (
            <ul className="max-h-40 list-inside list-disc overflow-y-auto text-xs text-amber-900">
              {preview.warnings.slice(0, 8).map((w) => (
                <li key={`${w.code}-${w.message}`}>{w.message}</li>
              ))}
              {preview.warnings.length > 8 ? (
                <li>…and {preview.warnings.length - 8} more</li>
              ) : null}
            </ul>
          ) : null}
          {preview.stats.items === 0 ? (
            <p className="text-sm text-amber-900">
              No importable items found. Your current Open Order menu is unchanged.
            </p>
          ) : null}
        </div>
      ) : null}

      {importReport ? (
        <div className="mt-4 space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
          <p className="font-medium">Import complete (draft, not published)</p>
          <ul className="grid gap-1 sm:grid-cols-2">
            <li>Imported mappings: {importReport.importedCount}</li>
            <li>Updated mappings: {importReport.updatedCount}</li>
            <li>Skipped objects: {importReport.skippedCount}</li>
            <li>Warnings: {importReport.warningCount}</li>
            <li>Inactive mappings: {importReport.inactiveMappingsCount}</li>
          </ul>
          <Link
            href={`/vendor/${vendorId}/menu-imports/${importReport.jobId}`}
            className="inline-flex text-sm font-semibold text-emerald-900 underline"
          >
            Review draft import
          </Link>
        </div>
      ) : null}
    </DashboardCard>
  );
}
