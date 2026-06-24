export type DashboardShellTier = "command" | "workspace" | "hub" | "admin";

export type DashboardCardVariant = "default" | "muted" | "accent" | "warning";

export type DashboardStatusTone = "success" | "warning" | "danger" | "neutral" | "info" | "muted";

export type DashboardMetricTone = "default" | "success" | "warning" | "danger" | "muted";

/** Layout width per dashboard tier. */
export const DASHBOARD_TIER_CLASS: Record<DashboardShellTier, string> = {
  command: "mx-auto w-full max-w-7xl px-4",
  workspace: "mx-auto w-full max-w-7xl px-4",
  hub: "mx-auto w-full max-w-3xl px-4",
  admin: "oo-shell w-full",
};

/** Offset for in-page anchor links under sticky titlebar / section nav. */
export const DASHBOARD_SECTION_SCROLL_CLASS = "scroll-mt-32";

export const DASHBOARD_SECTION_TITLE_CLASS =
  "text-xs font-semibold uppercase tracking-wider text-oo-stone-gray";

export const DASHBOARD_CARD_VARIANT_CLASS: Record<DashboardCardVariant, string> = {
  default: "border-oo-light-stone bg-oo-warm-white",
  muted: "border-oo-light-stone bg-oo-cream/50",
  accent: "border-brand/20 bg-brand-muted/40",
  warning: "border-amber-200/80 bg-amber-50/70",
};

export const DASHBOARD_STATUS_TONE_CLASS: Record<DashboardStatusTone, string> = {
  success: "bg-emerald-50 text-emerald-900",
  warning: "bg-amber-50 text-amber-950",
  danger: "bg-red-50 text-red-800",
  neutral: "bg-zinc-100 text-zinc-800",
  info: "bg-sky-50 text-sky-900",
  muted: "bg-oo-cream text-oo-stone-gray",
};

export const DASHBOARD_METRIC_TONE_CLASS: Record<DashboardMetricTone, string> = {
  default: "border-oo-light-stone bg-oo-warm-white",
  success: "border-emerald-200/80 bg-emerald-50/50",
  warning: "border-amber-200/80 bg-amber-50/50",
  danger: "border-red-200/80 bg-red-50/50",
  muted: "border-oo-light-stone bg-oo-cream/60",
};
