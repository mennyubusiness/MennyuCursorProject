/**
 * Deliverect Store API: location opening hours.
 * @see https://developers.deliverect.com/reference/get_location-locationid-openinghours
 */
import "server-only";
import { env } from "@/lib/env";
import { getDeliverectAuthHeaders } from "@/integrations/deliverect/auth";
import {
  serializeVendorCustomerOrderingWeek,
  VENDOR_WEEKDAYS,
  type VendorCustomerOrderingWeek,
  type VendorWeekday,
} from "@/lib/vendor-customer-ordering-hours";

const DEFAULT_BASE = "https://api.deliverect.com";
const LOG_PREFIX = "[Deliverect opening hours API]";

const DELIVERECT_DAY_TO_WEEKDAY: Record<number, VendorWeekday> = {
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
  7: "sunday",
};

export type FetchDeliverectLocationOpeningHoursParams = {
  locationId: string;
  /** Prefer channel-specific overrides when present (Deliverect channel link id). */
  channelLinkId?: string | null;
};

export type FetchDeliverectLocationOpeningHoursResult = {
  ok: boolean;
  httpStatus: number;
  body: unknown;
  error?: string;
};

export type NormalizedDeliverectOpeningHours = {
  week: VendorCustomerOrderingWeek;
  timezone: string | null;
  source: "deliverect";
};

async function deliverectAuthHeadersForGet(): Promise<Record<string, string> | null> {
  const apiKey = env.DELIVERECT_API_KEY?.trim();
  if (apiKey) {
    return { Authorization: `Bearer ${apiKey}` };
  }
  const oauth = await getDeliverectAuthHeaders();
  if (!oauth.Authorization) return null;
  return oauth;
}

function extractPagedItems(body: unknown): unknown[] {
  if (body == null) return [];
  if (Array.isArray(body)) return body;
  if (typeof body !== "object") return [];
  const o = body as Record<string, unknown>;
  const items = o._items ?? o.items ?? o.data;
  if (Array.isArray(items)) return items;
  return [body];
}

function readOpeningHoursRows(node: unknown): unknown[] {
  if (!node || typeof node !== "object") return [];
  const o = node as Record<string, unknown>;
  const direct = o.openingHours;
  if (Array.isArray(direct)) return direct;
  const nested = o.openinghours;
  if (Array.isArray(nested)) return nested;
  return [];
}

function findChannelOpeningHours(node: unknown, channelLinkId: string): unknown[] | null {
  if (!node || typeof node !== "object") return null;
  const channels = (node as Record<string, unknown>).channels;
  if (!Array.isArray(channels)) return null;
  const match = channels.find((ch) => {
    if (!ch || typeof ch !== "object") return false;
    const c = ch as Record<string, unknown>;
    const id = c.id ?? c._id ?? c.channelLinkId ?? c.channelId;
    return typeof id === "string" && id.trim() === channelLinkId;
  });
  if (!match || typeof match !== "object") return null;
  const rows = readOpeningHoursRows(match);
  return rows.length > 0 ? rows : null;
}

function readTimezone(node: unknown): string | null {
  if (!node || typeof node !== "object") return null;
  const o = node as Record<string, unknown>;
  const tz = o.timezone ?? o.timeZone ?? o.tz;
  return typeof tz === "string" && tz.trim() ? tz.trim() : null;
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((v) => Number(v));
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/**
 * Merge multiple Deliverect intervals per day into one open window (earliest open, latest close).
 */
export function mergeDeliverectDayIntervals(
  rows: Array<{ dayOfWeek: number; startTime: string; endTime: string }>
): Map<VendorWeekday, { isOpen: true; openTime: string; closeTime: string }> {
  const merged = new Map<VendorWeekday, { openMin: number; closeMin: number }>();

  for (const row of rows) {
    const day = DELIVERECT_DAY_TO_WEEKDAY[row.dayOfWeek];
    if (!day) continue;
    if (!/^\d{2}:\d{2}$/.test(row.startTime) || !/^\d{2}:\d{2}$/.test(row.endTime)) continue;
    const openMin = timeToMinutes(row.startTime);
    const closeMin = timeToMinutes(row.endTime);
    if (closeMin <= openMin) continue;

    const existing = merged.get(day);
    if (!existing) {
      merged.set(day, { openMin, closeMin });
    } else {
      merged.set(day, {
        openMin: Math.min(existing.openMin, openMin),
        closeMin: Math.max(existing.closeMin, closeMin),
      });
    }
  }

  const out = new Map<VendorWeekday, { isOpen: true; openTime: string; closeTime: string }>();
  for (const [day, span] of merged) {
    out.set(day, {
      isOpen: true,
      openTime: minutesToTime(span.openMin),
      closeTime: minutesToTime(span.closeMin),
    });
  }
  return out;
}

function parseDeliverectInterval(row: unknown): { dayOfWeek: number; startTime: string; endTime: string } | null {
  if (!row || typeof row !== "object") return null;
  const o = row as Record<string, unknown>;
  const dayRaw = o.dayOfWeek ?? o.day;
  const dayOfWeek = typeof dayRaw === "number" ? dayRaw : Number(dayRaw);
  const startTime = typeof o.startTime === "string" ? o.startTime.trim() : "";
  const endTime = typeof o.endTime === "string" ? o.endTime.trim() : "";
  if (!Number.isFinite(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7) return null;
  if (!startTime || !endTime) return null;
  return { dayOfWeek, startTime, endTime };
}

/**
 * Normalize Deliverect opening hours payload into OO weekly hours.
 * Prefers channel-specific hours when channelLinkId matches.
 */
export function normalizeDeliverectOpeningHoursResponse(
  body: unknown,
  channelLinkId?: string | null
): NormalizedDeliverectOpeningHours | null {
  const items = extractPagedItems(body);
  if (items.length === 0) return null;

  const root = items[0];
  const channelId = channelLinkId?.trim() || null;
  const channelRows = channelId ? findChannelOpeningHours(root, channelId) : null;
  const locationRows = readOpeningHoursRows(root);
  const rawRows = channelRows ?? locationRows;

  const parsed = rawRows
    .map(parseDeliverectInterval)
    .filter((row): row is { dayOfWeek: number; startTime: string; endTime: string } => row != null);

  if (parsed.length === 0) return null;

  const merged = mergeDeliverectDayIntervals(parsed);
  const week = serializeVendorCustomerOrderingWeek(
    VENDOR_WEEKDAYS.map((day) => {
      const open = merged.get(day);
      return open
        ? { day, isOpen: true, openTime: open.openTime, closeTime: open.closeTime }
        : { day, isOpen: false, openTime: "09:00", closeTime: "17:00" };
    })
  );

  return {
    week,
    timezone: readTimezone(root),
    source: "deliverect",
  };
}

export async function fetchDeliverectLocationOpeningHours(
  params: FetchDeliverectLocationOpeningHoursParams
): Promise<FetchDeliverectLocationOpeningHoursResult> {
  const locationId = params.locationId.trim();
  if (!locationId) {
    return { ok: false, httpStatus: 400, body: null, error: "missing_location_id" };
  }

  const base = (env.DELIVERECT_API_URL ?? DEFAULT_BASE).replace(/\/$/, "");
  const url = `${base}/location/${encodeURIComponent(locationId)}/openingHours`;

  const authHeaders = await deliverectAuthHeadersForGet();
  if (!authHeaders) {
    return {
      ok: false,
      httpStatus: 503,
      body: null,
      error:
        "Deliverect API not configured: set DELIVERECT_API_KEY or DELIVERECT_CLIENT_ID + DELIVERECT_CLIENT_SECRET",
    };
  }

  try {
    console.info(`${LOG_PREFIX} GET ${url}`);
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...authHeaders,
      },
    });

    const body = (await res.json().catch(() => null)) as unknown;
    if (!res.ok) {
      const msg =
        body && typeof body === "object" && body !== null && "message" in body
          ? String((body as { message?: unknown }).message)
          : res.statusText;
      console.warn(`${LOG_PREFIX} Non-OK status=${res.status} message=${msg}`);
      return {
        ok: false,
        httpStatus: res.status,
        body,
        error: `Deliverect opening hours API HTTP ${res.status}: ${msg}`,
      };
    }

    return { ok: true, httpStatus: res.status, body };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn(`${LOG_PREFIX} fetch error: ${message}`);
    return { ok: false, httpStatus: 0, body: null, error: message };
  }
}
