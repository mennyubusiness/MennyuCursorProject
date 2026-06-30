"use client";

type MenuBuilderAccessibleReorderProps = {
  label: string;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  disabled?: boolean;
};

/** Screen-reader fallback when drag-and-drop is the primary reorder control. */
export function MenuBuilderAccessibleReorder({
  label,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  disabled,
}: MenuBuilderAccessibleReorderProps) {
  return (
    <div className="sr-only" aria-label={`Reorder ${label}`}>
      <button type="button" disabled={disabled || !canMoveUp} onClick={onMoveUp}>
        Move {label} up
      </button>
      <button type="button" disabled={disabled || !canMoveDown} onClick={onMoveDown}>
        Move {label} down
      </button>
    </div>
  );
}
