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
import { VendorLogo } from "@/components/images/VendorLogo";

export type PodRosterVendorRow = {
  vendorId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  isFeatured: boolean;
  isActive: boolean;
  mennyuOrdersPaused: boolean;
};

function SortableRosterRow({
  podId,
  row,
  onToggleFeatured,
  onOpenRemove,
  disabled,
}: {
  podId: string;
  row: PodRosterVendorRow;
  onToggleFeatured: (vendorId: string, next: boolean) => void;
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

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex flex-wrap items-start gap-3 border-b border-stone-100 bg-white px-3 py-3 last:border-0 sm:flex-nowrap ${
        isDragging ? "shadow-md ring-1 ring-stone-200" : ""
      }`}
    >
      <button
        type="button"
        className="mt-1 cursor-grab touch-none rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 active:cursor-grabbing"
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
          <span className="font-medium text-stone-900">{row.name}</span>
          {row.isFeatured && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
              Featured
            </span>
          )}
        </div>
        {row.description ? (
          <p className="mt-0.5 line-clamp-2 text-sm text-stone-600">{row.description}</p>
        ) : (
          <p className="mt-0.5 text-sm text-stone-400">No description</p>
        )}
        <div className="mt-1 text-xs text-stone-500">
          {!row.isActive || row.mennyuOrdersPaused ? (
            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-900">Paused</span>
          ) : (
            <span className="text-emerald-800">Active</span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={row.isFeatured}
            disabled={disabled}
            onChange={(e) => onToggleFeatured(row.vendorId, e.target.checked)}
            className="rounded border-stone-300"
          />
          Featured
        </label>
        <details className="relative">
          <summary className="list-none cursor-pointer rounded border border-stone-200 bg-white px-2 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50 [&::-webkit-details-marker]:hidden">
            More
          </summary>
          <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-stone-200 bg-white py-1 shadow-lg">
            <Link
              href={`/pod/${podId}/vendor/${row.vendorId}`}
              className="block px-3 py-2 text-sm text-stone-800 hover:bg-stone-50"
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
  initialRows,
}: {
  podId: string;
  initialRows: PodRosterVendorRow[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [saving, setSaving] = useState(false);
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

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-500">
        No vendors in this pod yet. Invite vendors below.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {saving && <p className="text-xs text-stone-500">Saving order…</p>}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={rows.map((r) => r.vendorId)} strategy={verticalListSortingStrategy}>
          <ul className="rounded-lg border border-stone-200 bg-white">
            {rows.map((row) => (
              <SortableRosterRow
                key={row.vendorId}
                podId={podId}
                row={row}
                onToggleFeatured={onToggleFeatured}
                onOpenRemove={(id, name) => setRemoveModal({ vendorId: id, name })}
                disabled={saving || removing}
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
            className="max-w-md rounded-xl border border-stone-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id={modalTitleId} className="text-lg font-semibold text-stone-900">
              Remove from pod?
            </h2>
            <p className="mt-2 text-sm text-stone-600">
              <strong>{removeModal.name}</strong> will be removed from this pod only. Their Mennyu vendor
              account, menu, and history stay intact. You can invite them again later.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={removing}
                onClick={() => setRemoveModal(null)}
                className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 hover:bg-stone-50 disabled:opacity-50"
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
