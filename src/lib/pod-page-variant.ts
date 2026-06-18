/**
 * Customer-facing pod page template resolution.
 *
 * Resolution order:
 * 1. Valid `?variant=` query override (internal/dev testing)
 * 2. Future pod-level template field from Pod settings
 * 3. Default: destination
 *
 * Future: read page template from Pod settings once pod owner template picker is added.
 */

/** All known template ids, including layouts not yet implemented. */
export type PodPageTemplateId = "destination" | "classic" | "minimal";

/** Templates with an implemented page view today. */
export type PodPageTemplate = "destination" | "classic";

/** @deprecated Use {@link PodPageTemplate}. Kept for existing imports/tests. */
export type PodPageVariant = PodPageTemplate;

export const DEFAULT_POD_PAGE_TEMPLATE: PodPageTemplate = "destination";

export type ResolvePodPageTemplateInput = {
  podId: string;
  podSlug: string;
  variantParam?: string | null;
  /** Future: populated from Pod.pageTemplate once pod owner template picker is added. */
  podTemplate?: PodPageTemplateId | null;
};

function resolveQueryTemplateOverride(variantParam?: string | null): PodPageTemplate | null | "invalid" {
  const param = variantParam?.trim().toLowerCase();
  if (!param) return null;

  if (param === "destination") return "destination";
  if (param === "standard" || param === "classic") return "classic";

  return "invalid";
}

function normalizePodTemplate(value: PodPageTemplateId | string): PodPageTemplate | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "destination") return "destination";
  if (normalized === "classic" || normalized === "standard") return "classic";
  // minimal and unknown values fall through to default until implemented.
  return null;
}

export function resolvePodPageTemplate(input: ResolvePodPageTemplateInput): PodPageTemplate {
  const queryOverride = resolveQueryTemplateOverride(input.variantParam);
  if (queryOverride === "invalid") return DEFAULT_POD_PAGE_TEMPLATE;
  if (queryOverride) return queryOverride;

  if (input.podTemplate) {
    const fromPod = normalizePodTemplate(input.podTemplate);
    if (fromPod) return fromPod;
  }

  return DEFAULT_POD_PAGE_TEMPLATE;
}

/** @deprecated Prefer {@link resolvePodPageTemplate}. */
export function resolvePodPageVariant(input: ResolvePodPageTemplateInput): PodPageTemplate {
  return resolvePodPageTemplate(input);
}

export function isDestinationPodPage(input: ResolvePodPageTemplateInput): boolean {
  return resolvePodPageTemplate(input) === "destination";
}

export function isClassicPodPage(input: ResolvePodPageTemplateInput): boolean {
  return resolvePodPageTemplate(input) === "classic";
}
