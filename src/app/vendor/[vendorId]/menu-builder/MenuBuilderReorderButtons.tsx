"use client";

type MenuBuilderReorderButtonsProps = {
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  disabled?: boolean;
  label: string;
};

export function MenuBuilderReorderButtons({
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  disabled,
  label,
}: MenuBuilderReorderButtonsProps) {
  return (
    <div className="flex shrink-0 flex-col gap-0.5" aria-label={`Reorder ${label}`}>
      <button
        type="button"
        disabled={disabled || !canMoveUp}
        onClick={onMoveUp}
        title="Move up"
        aria-label={`Move ${label} up`}
        className="rounded border border-oo-light-stone bg-white px-1.5 py-0.5 text-xs text-oo-charcoal hover:bg-oo-cream disabled:opacity-40"
      >
        ↑
      </button>
      <button
        type="button"
        disabled={disabled || !canMoveDown}
        onClick={onMoveDown}
        title="Move down"
        aria-label={`Move ${label} down`}
        className="rounded border border-oo-light-stone bg-white px-1.5 py-0.5 text-xs text-oo-charcoal hover:bg-oo-cream disabled:opacity-40"
      >
        ↓
      </button>
    </div>
  );
}
