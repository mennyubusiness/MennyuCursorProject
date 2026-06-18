/** Platform capability copy — never used in the destination marquee. */
export const OPEN_ORDER_MARQUEE_BANNED = new Set([
  "ONE CHECKOUT",
  "GROUP ORDERING",
  "PICKUP UPDATES",
  "SCAN QR",
  "ORDER TOGETHER",
  "OPEN FOR ORDERS",
  "OPEN ORDER",
  "QR ORDERING",
  "MULTI-VENDOR CART",
]);

const GENERIC_VENUE_PHRASES = [
  "FOOD CARTS",
  "LOCAL FLAVOR",
  "GRAB A TABLE",
  "EAT OUTSIDE",
  "LOCAL FOOD CARTS",
  "EAT LOCAL",
] as const;

const MAX_MARQUEE_UNIQUE_VENDORS = 16;

/** Minimum labels in one marquee row before duplicating for the -50% loop. */
export const DESTINATION_MARQUEE_MIN_ROW_ITEMS = 24;

export type DestinationMarqueeKind = "vendors" | "fallback";

export type DestinationMarqueeContent = {
  kind: DestinationMarqueeKind;
  items: string[];
};

export function cleanMarqueeLabel(raw: string): string | null {
  const stripped = raw.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  if (!stripped) return null;
  return stripped.toUpperCase().slice(0, 40);
}

function collectLabels(
  sources: Array<string | null | undefined>,
  seen: Set<string>,
  items: string[]
) {
  for (const source of sources) {
    const cleaned = source ? cleanMarqueeLabel(source) : null;
    if (!cleaned || seen.has(cleaned) || OPEN_ORDER_MARQUEE_BANNED.has(cleaned)) continue;
    seen.add(cleaned);
    items.push(cleaned);
  }
}

function buildCleanedVendorLabels(vendorNames: string[]): string[] {
  const seen = new Set<string>();
  const items: string[] = [];
  collectLabels(vendorNames, seen, items);
  return items;
}

/** How many times to repeat the full vendor list in one marquee row. */
export function getMarqueeRepeatCycles(uniqueVendorCount: number): number {
  if (uniqueVendorCount <= 1) return 12;
  if (uniqueVendorCount <= 3) return 10;
  if (uniqueVendorCount <= 6) return 6;
  return 4;
}

/** Repeat the base vendor list enough times to avoid blank gaps on wide viewports. */
export function expandMarqueeLoopItems(uniqueLabels: string[]): string[] {
  if (uniqueLabels.length === 0) return [];

  const capped = uniqueLabels.slice(0, MAX_MARQUEE_UNIQUE_VENDORS);
  const cycles = getMarqueeRepeatCycles(capped.length);
  const expanded: string[] = [];

  for (let cycle = 0; cycle < cycles; cycle++) {
    expanded.push(...capped);
  }

  while (expanded.length < DESTINATION_MARQUEE_MIN_ROW_ITEMS) {
    expanded.push(...capped);
  }

  return expanded;
}

function buildFallbackLabels(podName: string): string[] {
  const seen = new Set<string>();
  const items: string[] = [];

  collectLabels([podName], seen, items);
  collectLabels([...GENERIC_VENUE_PHRASES], seen, items);

  return expandMarqueeLoopItems(items);
}

/**
 * Destination marquee — vendor names only, or venue fallback when no vendors.
 */
export function buildDestinationMarqueeContent(input: {
  podName: string;
  vendorNames: string[];
}): DestinationMarqueeContent {
  const vendorLabels = buildCleanedVendorLabels(input.vendorNames);

  if (vendorLabels.length > 0) {
    return {
      kind: "vendors",
      items: expandMarqueeLoopItems(vendorLabels),
    };
  }

  return {
    kind: "fallback",
    items: buildFallbackLabels(input.podName),
  };
}

/** @deprecated Use `buildDestinationMarqueeContent` for kind metadata. */
export function buildDestinationMarqueeItems(
  input: Parameters<typeof buildDestinationMarqueeContent>[0]
): string[] {
  return buildDestinationMarqueeContent(input).items;
}
