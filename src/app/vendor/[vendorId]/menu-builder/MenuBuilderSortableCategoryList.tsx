"use client";

import React, { useEffect, useState } from "react";
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
import { useMenuBuilderDndSensors } from "./menu-builder-dnd";
import { MenuBuilderAccessibleReorder } from "./MenuBuilderAccessibleReorder";
import { MenuBuilderDragHandle } from "./MenuBuilderDragHandle";
import type { useMenuBuilderEditor } from "./useMenuBuilderEditor";

type Editor = ReturnType<typeof useMenuBuilderEditor>;
type Category = Editor["categories"][number];

function SortableCategoryRow({
  cat,
  catIndex,
  catCount,
  status,
  nameError,
  reorderDisabled,
  onNameCommit,
  onVisibleChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  deleteDisabled,
  deleteStatus,
}: {
  cat: Category;
  catIndex: number;
  catCount: number;
  status: ReturnType<Editor["getEntityStatus"]>;
  nameError: string | null;
  reorderDisabled: boolean;
  onNameCommit: (name: string) => void;
  onVisibleChange: (isVisible: boolean) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  deleteDisabled: boolean;
  deleteStatus: ReturnType<Editor["getEntityStatus"]>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cat.id,
    disabled: cat.isTemp || reorderDisabled,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : undefined,
  };

  return (
    <CategoryRowContent
      cat={cat}
      catIndex={catIndex}
      catCount={catCount}
      status={status}
      nameError={nameError}
      reorderDisabled={reorderDisabled}
      onNameCommit={onNameCommit}
      onVisibleChange={onVisibleChange}
      onDelete={onDelete}
      onMoveUp={onMoveUp}
      onMoveDown={onMoveDown}
      deleteDisabled={deleteDisabled}
      deleteStatus={deleteStatus}
      rowRef={setNodeRef}
      rowStyle={style}
      isDragging={isDragging}
      dragHandle={
        <MenuBuilderDragHandle
          label={cat.name}
          disabled={cat.isTemp || reorderDisabled}
          attributes={attributes}
          listeners={listeners}
        />
      }
    />
  );
}

function CategoryRowContent({
  cat,
  catIndex,
  catCount,
  status,
  nameError,
  reorderDisabled,
  onNameCommit,
  onVisibleChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  deleteDisabled,
  deleteStatus,
  rowRef,
  rowStyle,
  isDragging,
  dragHandle,
}: {
  cat: Category;
  catIndex: number;
  catCount: number;
  status: ReturnType<Editor["getEntityStatus"]>;
  nameError: string | null;
  reorderDisabled: boolean;
  onNameCommit: (name: string) => void;
  onVisibleChange: (isVisible: boolean) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  deleteDisabled: boolean;
  deleteStatus: ReturnType<Editor["getEntityStatus"]>;
  rowRef?: (node: HTMLElement | null) => void;
  rowStyle?: React.CSSProperties;
  isDragging?: boolean;
  dragHandle: React.ReactNode;
}) {
  const [name, setName] = useState(cat.name);

  useEffect(() => {
    setName(cat.name);
  }, [cat.name]);

  return (
    <li
      ref={rowRef}
      style={rowStyle}
      id={`menu-builder-category-${cat.id}`}
      className={`scroll-mt-24 flex flex-wrap items-center gap-3 py-3 ${
        isDragging ? "rounded-lg bg-oo-warm-white shadow-md ring-1 ring-oo-light-stone" : ""
      }`}
    >
      {dragHandle}
      <MenuBuilderAccessibleReorder
        label={cat.name}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        canMoveUp={catIndex > 0}
        canMoveDown={catIndex < catCount - 1}
        disabled={cat.isTemp || reorderDisabled}
      />
      <div className="min-w-[10rem] flex-1 space-y-1">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            const trimmed = name.trim();
            if (trimmed !== cat.name) onNameCommit(trimmed);
          }}
          className={`w-full rounded-lg border px-3 py-2 text-sm ${
            nameError ? "border-red-300" : "border-oo-light-stone"
          }`}
        />
        {nameError ? <p className="text-xs text-red-700">{nameError}</p> : null}
        {status === "saving" ? <p className="text-xs text-oo-stone-gray">Saving…</p> : null}
      </div>
      <label className="flex items-center gap-2 text-sm text-oo-stone-gray">
        <input
          type="checkbox"
          checked={cat.isVisible}
          onChange={(e) => onVisibleChange(e.target.checked)}
        />
        Visible
      </label>
      <span className="text-xs text-oo-stone-gray">{cat.itemCount} items</span>
      <button
        type="button"
        disabled={deleteDisabled || deleteStatus === "saving" || cat.isTemp}
        title={deleteDisabled ? "Remove items first" : "Delete category"}
        onClick={onDelete}
        className="text-sm text-red-700 hover:underline disabled:opacity-40"
      >
        {deleteStatus === "saving" ? "Deleting…" : "Delete"}
      </button>
    </li>
  );
}

export function MenuBuilderSortableCategoryList({
  categories,
  editor,
}: {
  categories: Category[];
  editor: Editor;
}) {
  const sensors = useMenuBuilderDndSensors();
  const reorderDisabled = editor.getEntityStatus("category-reorder") === "saving";

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = categories.findIndex((category) => category.id === active.id);
    const newIndex = categories.findIndex((category) => category.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(categories, oldIndex, newIndex);
    editor.reorderCategoriesByIds(next.map((category) => category.id));
  };

  if (categories.length === 0) {
    return <li className="py-3 text-sm text-oo-stone-gray">No categories yet.</li>;
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={categories.map((category) => category.id)} strategy={verticalListSortingStrategy}>
        {categories.map((cat, catIndex) => (
          <SortableCategoryRow
            key={cat.id}
            cat={cat}
            catIndex={catIndex}
            catCount={categories.length}
            status={editor.getEntityStatus(`cat-name:${cat.id}`)}
            nameError={editor.getEntityError(`cat-name:${cat.id}`)}
            reorderDisabled={reorderDisabled}
            onNameCommit={(name) => editor.updateCategoryName(cat.id, name)}
            onVisibleChange={(isVisible) => editor.updateCategoryVisible(cat.id, isVisible)}
            onDelete={() => editor.removeCategory(cat.id)}
            onMoveUp={() => editor.moveCategory(cat.id, "up")}
            onMoveDown={() => editor.moveCategory(cat.id, "down")}
            deleteDisabled={cat.itemCount > 0}
            deleteStatus={editor.getEntityStatus(`cat-delete:${cat.id}`)}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
}
