"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { VendorMenuBuilderModifierGroup } from "@/lib/vendor-menu-builder-data.server";
import { MenuBuilderAccessibleReorder } from "./MenuBuilderAccessibleReorder";
import { MenuBuilderDragHandle } from "./MenuBuilderDragHandle";
import { MenuBuilderItemModifiers } from "./MenuBuilderItemModifiers";
import { MenuBuilderItemPhoto } from "./MenuBuilderItemPhoto";
import { useMenuBuilderDndSensors } from "./menu-builder-dnd";
import { MenuPriceInput } from "./MenuPriceInput";
import type { useMenuBuilderEditor } from "./useMenuBuilderEditor";

type Editor = ReturnType<typeof useMenuBuilderEditor>;

type MenuBuilderItem = Editor["items"][number];

export function MenuBuilderSortableItemList({
  categoryId,
  items,
  vendorId,
  editor,
  modifierExpanded,
  onModifierExpandedChange,
  modifierValidationByItemId,
}: {
  categoryId: string;
  items: MenuBuilderItem[];
  vendorId: string;
  editor: Editor;
  modifierExpanded: Record<string, boolean | undefined>;
  onModifierExpandedChange: (itemId: string, expanded: boolean) => void;
  modifierValidationByItemId: Record<string, { hasError: boolean; issueCount: number }>;
}) {
  const sensors = useMenuBuilderDndSensors();
  const reorderDisabled = editor.getEntityStatus(`item-reorder:${categoryId}`) === "saving";
  const sortableIds = items.filter((item) => !item.isTemp).map((item) => item.id);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(items, oldIndex, newIndex);
    editor.reorderItemsInCategoryByIds(
      categoryId,
      next.map((item) => item.id)
    );
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
        <ul className="mt-3 space-y-4">
          {items.map((item, itemIndex) => (
            <SortableMenuItemCard
              key={item.id}
              categoryId={categoryId}
              item={item}
              itemIndex={itemIndex}
              itemCount={items.length}
              vendorId={vendorId}
              editor={editor}
              reorderDisabled={reorderDisabled}
              modifierExpanded={modifierExpanded[item.id]}
              modifierValidation={modifierValidationByItemId[item.id]}
              onModifierExpandedChange={(expanded) => onModifierExpandedChange(item.id, expanded)}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableMenuItemCard({
  categoryId,
  item,
  itemIndex,
  itemCount,
  vendorId,
  editor,
  reorderDisabled,
  modifierExpanded,
  modifierValidation,
  onModifierExpandedChange,
}: {
  categoryId: string;
  item: MenuBuilderItem;
  itemIndex: number;
  itemCount: number;
  vendorId: string;
  editor: Editor;
  reorderDisabled: boolean;
  modifierExpanded: boolean | undefined;
  modifierValidation?: { hasError: boolean; issueCount: number };
  onModifierExpandedChange: (expanded: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: item.isTemp || reorderDisabled,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : undefined,
  };

  const groups = item.modifierGroups ?? [];
  const hasModifierErrors = modifierValidation?.hasError ?? false;
  const expanded =
    modifierExpanded !== undefined ? modifierExpanded : hasModifierErrors;

  return (
    <li
      ref={setNodeRef}
      style={style}
      id={`menu-builder-item-${item.id}`}
      className={`scroll-mt-24 rounded-xl border border-oo-light-stone bg-white p-4 shadow-sm ${
        isDragging ? "ring-1 ring-oo-light-stone" : ""
      }`}
    >
      <MenuBuilderItemRow
        categoryId={categoryId}
        item={item}
        vendorId={vendorId}
        editor={editor}
        itemIndex={itemIndex}
        itemCount={itemCount}
        reorderDisabled={reorderDisabled}
        dragHandle={
          <MenuBuilderDragHandle
            label={item.name}
            disabled={item.isTemp || reorderDisabled}
            attributes={attributes}
            listeners={listeners}
          />
        }
        groups={groups}
        modifierExpanded={expanded}
        modifierIssueCount={modifierValidation?.issueCount ?? 0}
        hasModifierValidationError={hasModifierErrors}
        onModifierExpandedChange={onModifierExpandedChange}
      />
    </li>
  );
}

function MenuBuilderItemRow({
  categoryId,
  vendorId,
  item,
  editor,
  itemIndex,
  itemCount,
  reorderDisabled,
  dragHandle,
  groups,
  modifierExpanded,
  modifierIssueCount,
  hasModifierValidationError,
  onModifierExpandedChange,
}: {
  categoryId: string;
  vendorId: string;
  item: {
    id: string;
    name: string;
    priceCents: number;
    isAvailable: boolean;
    imageUrl: string | null;
    isTemp?: boolean;
  };
  editor: Editor;
  itemIndex: number;
  itemCount: number;
  reorderDisabled: boolean;
  dragHandle: ReactNode;
  groups: VendorMenuBuilderModifierGroup[];
  modifierExpanded: boolean;
  modifierIssueCount: number;
  hasModifierValidationError: boolean;
  onModifierExpandedChange: (expanded: boolean) => void;
}) {
  const [name, setName] = useState(item.name);

  useEffect(() => {
    setName(item.name);
  }, [item.name]);

  return (
    <>
      <div className="flex flex-wrap gap-4">
        {dragHandle}
        <MenuBuilderAccessibleReorder
          label={item.name}
          onMoveUp={() => editor.moveItemInCategory(categoryId, item.id, "up")}
          onMoveDown={() => editor.moveItemInCategory(categoryId, item.id, "down")}
          canMoveUp={itemIndex > 0}
          canMoveDown={itemIndex < itemCount - 1}
          disabled={item.isTemp || reorderDisabled}
        />
        <MenuBuilderItemPhoto
          vendorId={vendorId}
          itemId={item.id}
          itemName={item.name}
          imageUrl={item.imageUrl}
          disabled={item.isTemp}
          onImageChange={(url) => editor.updateItemImage(item.id, url)}
          status={editor.getEntityStatus(`item-image:${item.id}`)}
          error={editor.getEntityError(`item-image:${item.id}`)}
        />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-oo-stone-gray">Item name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => {
                  const trimmed = name.trim();
                  if (trimmed !== item.name) editor.updateItemName(item.id, trimmed);
                }}
                className={`w-full rounded-lg border px-3 py-2 text-sm ${
                  editor.getEntityError(`item-name:${item.id}`)
                    ? "border-red-300"
                    : "border-oo-light-stone"
                }`}
              />
              {editor.getEntityError(`item-name:${item.id}`) ? (
                <p className="text-xs text-red-700">{editor.getEntityError(`item-name:${item.id}`)}</p>
              ) : null}
              {editor.getEntityStatus(`item-name:${item.id}`) === "saving" ? (
                <p className="text-xs text-oo-stone-gray">Saving…</p>
              ) : null}
            </div>
            <div>
              <MenuPriceInput
                cents={item.priceCents}
                compact
                onCommit={(raw) => editor.updateItemPrice(item.id, raw)}
                error={editor.getEntityError(`item-price:${item.id}`)}
                status={editor.getEntityStatus(`item-price:${item.id}`)}
              />
            </div>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={item.isAvailable}
                  onChange={(e) => editor.updateItemAvailable(item.id, e.target.checked)}
                />
                {item.isAvailable ? "Available" : "Sold out"}
              </label>
              <button
                type="button"
                disabled={editor.getEntityStatus(`item-delete:${item.id}`) === "saving" || item.isTemp}
                onClick={() => editor.removeItem(item.id)}
                className="text-sm text-red-700 hover:underline disabled:opacity-40"
              >
                {editor.getEntityStatus(`item-delete:${item.id}`) === "saving" ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      </div>
      <MenuBuilderItemModifiers
        vendorId={vendorId}
        itemId={item.id}
        itemName={item.name}
        groups={groups}
        editor={editor}
        disabled={item.isTemp}
        expanded={modifierExpanded}
        onExpandedChange={onModifierExpandedChange}
        hasValidationError={hasModifierValidationError}
        validationIssueCount={modifierIssueCount}
        onAddGroup={() => onModifierExpandedChange(true)}
      />
    </>
  );
}
