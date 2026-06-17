export type GroupCartEmptyStateKind =
  | "has_items"
  | "solo_empty"
  | "host_group_empty"
  | "participant_group_empty";

export function resolveGroupCartEmptyState(args: {
  displayItemCount: number;
  goStateActive: boolean;
  goView: "host" | "participant" | "unknown" | null;
}): GroupCartEmptyStateKind {
  if (args.displayItemCount > 0) return "has_items";
  if (!args.goStateActive) return "solo_empty";
  if (args.goView === "host") return "host_group_empty";
  if (args.goView === "participant") return "participant_group_empty";
  return "solo_empty";
}

export function shouldShowJoinGroupOrderForm(args: {
  goStateActive: boolean;
  cartItemCount?: number;
}): boolean {
  if (args.goStateActive) return false;
  if ((args.cartItemCount ?? 0) > 0) return false;
  return true;
}
