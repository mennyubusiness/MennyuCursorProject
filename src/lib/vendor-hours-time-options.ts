/** HH:MM options for vendor customer ordering hours (15-minute steps). */
export const VENDOR_HOURS_TIME_OPTIONS: string[] = (() => {
  const options: string[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (let minute = 0; minute < 60; minute += 15) {
      options.push(`${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`);
    }
  }
  return options;
})();

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidVendorHoursTime(value: string): boolean {
  return TIME_RE.test(value);
}

export function formatVendorHoursTimeLabel(hhmm: string): string {
  if (!isValidVendorHoursTime(hhmm)) return hhmm;
  const [hRaw, mRaw] = hhmm.split(":");
  const h24 = Number(hRaw);
  const m = Number(mRaw);
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${period}`;
}

/** Snap arbitrary HH:MM to the nearest 15-minute option (for legacy values). */
export function snapVendorHoursTimeToOption(hhmm: string): string {
  if (!isValidVendorHoursTime(hhmm)) return "09:00";
  const [hRaw, mRaw] = hhmm.split(":");
  const total = Number(hRaw) * 60 + Number(mRaw);
  const snapped = Math.round(total / 15) * 15;
  const clamped = Math.min(23 * 60 + 45, Math.max(0, snapped));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}
