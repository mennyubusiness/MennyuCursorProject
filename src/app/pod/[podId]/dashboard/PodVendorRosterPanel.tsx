"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { updatePodVendorPresentation } from "@/actions/pod-settings.actions";
import { buildVendorMenuCustomerPath } from "@/lib/customer-public-url";
import type { VendorOrderRoutingMode } from "@prisma/client";
import { podOwnerVendorDisplayStatus } from "@/lib/pod-vendor-adoption";
import { VendorLogo } from "@/components/images/VendorLogo";
import { PodRosterReadinessSummary, type PodRosterReadinessSnapshot } from "./PodRosterReadinessSummary";

export type PodRosterVendorRow = {
  vendorId: string;
  vendorSlug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  isFeatured: boolean;
  /** Pod owner control: visible/orderable in this pod. */
  podVendorActive: boolean;
  /** Platform/admin global vendor state. */
  vendorGloballyActive: boolean;
  /** Vendor-controlled global pause across Open Order. */
  mennyuOrdersPaused: boolean;
  orderRoutingMode: VendorOrderRoutingMode;
  readiness: PodRosterReadinessSnapshot;
};

function rosterStatusBadge(readiness: PodRosterReadinessSnapshot) {
  const displayStatus = podOwnerVendorDisplayStatus(readiness.status, readiness.canAcceptOrders);
  if (displayStatus === "Live") {
    return { label: displayStatus, className: "rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-900" };
  }
  if (
    displayStatus.startsWith("Needs ") ||
    displayStatus === "Paused in pod" ||
    displayStatus === "Paused by vendor"
  ) {
    return { label: displayStatus, className: "rounded bg-amber-50 px-1.5 py-0.5 text-amber-900" };
  }
  return { label: displayStatus, className: "rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-800" };
}

function SortableRosterRow({
  podSlug,
  row,
  onToggleFeatured,
  onTogglePodVendorActive,
  onOpenRemove,
  disabled,
}: {
  podSlug: string;
  row: PodRosterVendorRow;
  onToggleFeatured: (vendorId: string, next: boolean) => void;
  onTogglePodVendorActive: (vendorId: string, next: boolean) => void;
  onOpenRemove: (vendorId: string, name: string) => void;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.vendorId,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : undefined,
  };
  const badges = rosterStatusBadge(row.readiness);

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex flex-wrap items-start gap-3 border-b border-oo-light-stone bg-oo-warm-white px-3 py-3 last:border-0 sm:flex-nowrap ${
        isDragging ? "shadow-md ring-1 ring-stone-200" : ""
      }`}
    >
      <button
        type="button"
        className="mt-1 cursor-grab touch-none rounded p-1 text-oo-stone-gray hover:bg-oo-cream hover:text-oo-charcoal active:cursor-grabbing"
        aria-label={`Move ${row.name}`}
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <span className="block text-lg leading-none" aria-hidden>
          ⋮⋮
        </span>
      </button>
      <VendorLogo
        imageUrl={row.imageUrl}
        vendorName={row.name}
        className="h-12 w-12 shrink-0 rounded-lg"
        sizes="48px"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 break-words font-medium text-oo-charcoal">{row.name}</span>
          {row.isFeatured && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
              Featured
            </span>
          )}
        </div>
        {row.description ? (
          <p className="mt-0.5 line-clamp-2 text-sm text-oo-stone-gray">{row.description}</p>
        ) : (
          <p className="mt-0.5 text-sm text-oo-stone-gray">No description</p>
        )}
        <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
          <span className={badges.className}>{badges.label}</span>
        </div>
        <PodRosterReadinessSummary readiness={row.readiness} orderRoutingMode={row.orderRoutingMode} />
      </div>
      <div className="flex w-full shrink-0 flex-wrap items-stretch gap-2 sm:w-auto sm:flex-nowrap sm:items-center sm:justify-end">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-oo-charcoal">
          <input
            type="checkbox"
            checked={row.isFeatured}
            disabled={disabled}
            onChange={(e) => onToggleFeatured(row.vendorId, e.target.checked)}
            className="rounded border-oo-light-stone"
          />
          Featured
        </label>
        <button
          type="button"
          disabled={disabled || !row.vendorGloballyActive}
          onClick={() => onTogglePodVendorActive(row.vendorId, !row.podVendorActive)}
          className="rounded border border-oo-light-stone bg-oo-warm-white px-2 py-1.5 text-sm font-medium text-oo-charcoal hover:bg-oo-cream disabled:opacity-50"
          title={
            !row.vendorGloballyActive
              ? "This vendor is inactive platform-wide. Contact Open Order support."
              : row.podVendorActive
                ? "Hide this vendor from your public pod page and stop new orders here."
                : "Show this vendor on your public pod page and allow new orders here."
          }
        >
          {row.podVendorActive ? "Pause in pod" : "Show in pod"}
        </button>
        <details className="relative">
          <summary className="list-none cursor-pointer rounded border border-oo-light-stone bg-oo-warm-white px-2 py-1.5 text-sm font-medium text-oo-charcoal hover:bg-oo-cream [&::-webkit-details-marker]:hidden">
            More
          </summary>
          <div className="absolute left-0 z-20 mt-1 w-48 rounded-lg border border-oo-light-stone bg-oo-warm-white py-1 shadow-lg sm:left-auto sm:right-0">
            <Link
              href={buildVendorMenuCustomerPath(podSlug, row.vendorSlug)}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-3 py-2 text-sm text-oo-charcoal hover:bg-oo-cream"
            >
              View vendor page
            </Link>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onOpenRemove(row.vendorId, row.name)}
              className="w-full px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Remove from pod
            </button>
          </div>
        </details>
      </div>
    </li>
  );
}

export function PodVendorRosterPanel({
  podId,
  podSlug,
  initialRows,
}: {
  podId: string;
  podSlug: string;
  initialRows: PodRosterVendorRow[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [saving, setSaving] = useState(false);
  const [togglingVendorId, setTogglingVendorId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removeModal, setRemoveModal] = useState<{ vendorId: string; name: string } | null>(null);
  const [removing, setRemoving] = useState(false);
  const modalTitleId = useId();

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  const persist = useCallback(
    async (nextRows: PodRosterVendorRow[]) => {
      setError(null);
      setSaving(true);
      try {
        const res = await updatePodVendorPresentation(
          podId,
          nextRows.map((r) => ({ vendorId: r.vendorId, isFeatured: r.isFeatured }))
        );
        if (!res.ok) {
          setError(res.error ?? "Could not save");
          return;
        }
        router.refresh();
      } finally {
        setSaving(false);
      }
    },
    [podId, router]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setRows((prev) => {
      const oldIndex = prev.findIndex((r) => r.vendorId === active.id);
      const newIndex = prev.findIndex((r) => r.vendorId === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      const next = arrayMove(prev, oldIndex, newIndex);
      void persist(next);
      return next;
    });
  };

  const onToggleFeatured = (vendorId: string, isFeatured: boolean) => {
    setRows((prev) => {
      const next = prev.map((r) => (r.vendorId === vendorId ? { ...r, isFeatured } : r));
      void persist(next);
      return next;
    });
  };

  async function onTogglePodVendorActive(vendorId: string, isActive: boolean) {
    setError(null);
    setTogglingVendorId(vendorId);
    const previous = rows;
    setRows((prev) => prev.map((r) => (r.vendorId === vendorId ? { ...r, podVendorActive: isActive } : r)));
    try {
      const res = await fetch(`/api/pod/${podId}/vendors/${vendorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRows(previous);
        setError(data.error ?? "Could not update vendor visibility");
        return;
      }
      router.refresh();
    } finally {
      setTogglingVendorId(null);
    }
  }

  async function confirmRemove() {
    if (!removeModal) return;
    setRemoving(true);
    setError(null);
    try {
      const res = await fetch(`/api/pod/${podId}/vendors/${removeModal.vendorId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to remove vendor");
        return;
      }
      setRemoveModal(null);
      router.refresh();
    } finally {
      setRemoving(false);
    }
  }

  const busy = saving || removing || togglingVendorId !== null;

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-oo-light-stone bg-oo-warm-white p-4 text-sm text-oo-stone-gray">
        No vendors in this pod yet. Use Invite vendors to add one.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {saving && <p className="text-xs text-oo-stone-gray">Saving order…</p>}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={rows.map((r) => r.vendorId)} strategy={verticalListSortingStrategy}>
          <ul className="rounded-lg border border-oo-light-stone bg-oo-warm-white">
            {rows.map((row) => (
              <SortableRosterRow
                key={row.vendorId}
                podSlug={podSlug}
                row={row}
                onToggleFeatured={onToggleFeatured}
                onTogglePodVendorActive={(vendorId, next) => void onTogglePodVendorActive(vendorId, next)}
                onOpenRemove={(id, name) => setRemoveModal({ vendorId: id, name })}
                disabled={busy}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {removeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={() => !removing && setRemoveModal(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={modalTitleId}
            className="max-w-md rounded-xl border border-oo-light-stone bg-oo-warm-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id={modalTitleId} className="text-lg font-semibold text-oo-charcoal">
              Remove from pod?
            </h2>
            <p className="mt-2 text-sm text-oo-stone-gray">
              <strong>{removeModal.name}</strong> will be removed from this pod only. Their Open Order vendor
              account, menu, and history stay intact. You can invite them again later.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={removing}
                onClick={() => setRemoveModal(null)}
                className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-4 py-2 text-sm font-medium text-oo-charcoal hover:bg-oo-cream disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={removing}
                onClick={() => void confirmRemove()}
                className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
              >
                {removing ? "Removing…" : "Remove from pod"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
