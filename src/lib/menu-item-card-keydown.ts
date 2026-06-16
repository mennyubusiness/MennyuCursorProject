import type { KeyboardEvent } from "react";

export function handleMenuItemCardKeyDown(
  event: KeyboardEvent,
  onActivate: () => void,
  disabled: boolean
): void {
  if (disabled) return;
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    onActivate();
  }
}
