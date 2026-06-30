export type MenuPriceParseResult =
  | { ok: true; cents: number }
  | { ok: false; error: string };

/**
 * Parse vendor-entered menu price text to integer cents.
 * Accepts flexible dollar input: 12, 12., 12.5, 12.50, 0, 0.99
 */
export function parseMenuPriceToCents(input: string): MenuPriceParseResult {
  const trimmed = input.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!trimmed) {
    return { ok: false, error: "Price is required." };
  }

  if (!/^\d*\.?\d*$/.test(trimmed) || trimmed === ".") {
    return { ok: false, error: "Price must be a valid dollar amount." };
  }

  const dotCount = (trimmed.match(/\./g) ?? []).length;
  if (dotCount > 1) {
    return { ok: false, error: "Price must be a valid dollar amount." };
  }

  const [dollarPartRaw, centPartRaw = ""] = trimmed.split(".");
  if (centPartRaw.length > 2) {
    return { ok: false, error: "Use at most two decimal places." };
  }

  const dollarPart = dollarPartRaw === "" ? "0" : dollarPartRaw;
  const dollars = Number(dollarPart);
  if (!Number.isFinite(dollars) || dollars < 0) {
    return { ok: false, error: "Price must be a valid dollar amount." };
  }

  const centsPart = centPartRaw.padEnd(2, "0").slice(0, 2);
  const frac = centPartRaw === "" ? 0 : Number(centsPart);
  if (!Number.isFinite(frac) || frac < 0) {
    return { ok: false, error: "Price must be a valid dollar amount." };
  }

  const totalCents = dollars * 100 + frac;
  if (!Number.isInteger(totalCents) || totalCents < 0) {
    return { ok: false, error: "Price must be a valid dollar amount." };
  }

  return { ok: true, cents: totalCents };
}

/** Editable menu price string without currency symbol (e.g. 12.50). */
export function formatCentsToMenuPrice(cents: number): string {
  if (!Number.isInteger(cents) || cents < 0) return "";
  return (cents / 100).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

/** Customer-facing currency display. */
export function formatCentsToCurrency(cents: number): string {
  if (!Number.isInteger(cents) || cents < 0) return "$0.00";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

/** Normalize draft input for display on blur (always two decimals when fractional). */
export function normalizeMenuPriceDraft(input: string): string {
  const parsed = parseMenuPriceToCents(input);
  if (!parsed.ok) return input.trim().replace(/^\$/, "");
  if (parsed.cents === 0) return "0";
  return (parsed.cents / 100).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}
