/** Query param for on-site QR / printed code entry (MVP). */
export const POD_QR_ENTRY_PARAM = "entry" as const;
export const POD_QR_ENTRY_VALUE = "qr" as const;

/** Relative path to the customer pod page (canonical ordering surface). */
export function buildPodPagePath(
  podId: string,
  opts?: { entry?: typeof POD_QR_ENTRY_VALUE }
): string {
  const base = `/pod/${podId}`;
  if (opts?.entry === POD_QR_ENTRY_VALUE) {
    return `${base}?${POD_QR_ENTRY_PARAM}=${POD_QR_ENTRY_VALUE}`;
  }
  return base;
}

/** Absolute URL for QR encoding and sharing (includes entry=qr for attribution-free MVP tracking). */
export function buildPodOrderingAbsoluteUrl(origin: string, podId: string): string {
  const o = origin.replace(/\/$/, "");
  return `${o}${buildPodPagePath(podId, { entry: POD_QR_ENTRY_VALUE })}`;
}
