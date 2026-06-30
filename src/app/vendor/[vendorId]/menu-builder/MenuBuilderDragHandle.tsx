"use client";

import type { DraggableAttributes } from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";

type MenuBuilderDragHandleProps = {
  label: string;
  disabled?: boolean;
  attributes: DraggableAttributes;
  listeners: SyntheticListenerMap | undefined;
};

export function MenuBuilderDragHandle({
  label,
  disabled,
  attributes,
  listeners,
}: MenuBuilderDragHandleProps) {
  return (
    <button
      type="button"
      className="mt-1 shrink-0 cursor-grab touch-none rounded-md p-2 text-oo-stone-gray hover:bg-oo-cream hover:text-oo-charcoal active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
      aria-label={`Drag to reorder ${label}`}
      disabled={disabled}
      {...attributes}
      {...listeners}
    >
      <span className="block text-lg leading-none" aria-hidden>
        ⋮⋮
      </span>
    </button>
  );
}
