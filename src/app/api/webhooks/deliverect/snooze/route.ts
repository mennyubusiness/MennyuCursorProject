/**
 * Deliverect Snooze / Unsnooze Products webhook → updates `MenuItem.isAvailable` and/or
 * `ModifierOption.isAvailable` only (no creates, no pricing, no menu structure).
 *
 * HMAC: same as `/api/webhooks/deliverect` and menu webhook — production uses
 * `DELIVERECT_WEBHOOK_SECRET`; staging/sandbox uses channel link id from JSON.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyDeliverectSignature } from "@/integrations/deliverect/webhook-handler";
import { env } from "@/lib/env";
import {
  extractChannelLinkIdSecret,
  getDeliverectSignatureFromRequest,
  isDeliverectWebhookProduction,
  nonEmptyStringField,
  resolveDeliverectWebhookVerificationSecret,
} from "@/integrations/deliverect/webhook-inbound-shared";
import {
  loadDeliverectSnoozePublishedScope,
  type DeliverectSnoozePublishedScope,
} from "@/services/deliverect-snooze-scope.service";

export const dynamic = "force-dynamic";

const LOG = "[DELIVERECT SNOOZE WEBHOOK]";

function methodNotAllowed() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}

export function GET() {
  return methodNotAllowed();
}
export function PUT() {
  return methodNotAllowed();
}
export function PATCH() {
  return methodNotAllowed();
}
export function DELETE() {
  return methodNotAllowed();
}
export function HEAD() {
  return methodNotAllowed();
}

type UnwrapOk = { ok: true; object: Record<string, unknown> };
type UnwrapErr = { ok: false; status: number; body: Record<string, unknown> };

/**
 * Body is usually `{ ... }`; allow `[{ ... }]` single-element array like menu push.
 */
function unwrapSnoozePayload(parsed: unknown): UnwrapOk | UnwrapErr {
  if (parsed === null || typeof parsed !== "object") {
    return {
      ok: false,
      status: 400,
      body: { error: "Invalid JSON body", code: "INVALID_JSON_SHAPE" },
    };
  }
  if (Array.isArray(parsed)) {
    if (parsed.length !== 1) {
      return {
        ok: false,
        status: 400,
        body: {
          error: "Snooze webhook expects one JSON object or a single-element array",
          code: "INVALID_ARRAY_WRAPPER",
        },
      };
    }
    const only = parsed[0];
    if (only === null || typeof only !== "object" || Array.isArray(only)) {
      return {
        ok: false,
        status: 400,
        body: { error: "Snooze webhook array must contain one object", code: "INVALID_ARRAY_ELEMENT" },
      };
    }
    return { ok: true, object: only as Record<string, unknown> };
  }
  return { ok: true, object: parsed as Record<string, unknown> };
}

function parseAction(raw: unknown): "snooze" | "unsnooze" | null {
  const s = nonEmptyStringField(raw)?.toLowerCase();
  if (s === "snooze" || s === "unsnooze") return s;
  return null;
}

function isAvailableForAction(action: "snooze" | "unsnooze"): boolean {
  return action === "unsnooze";
}

type MatchedKind =
  | "menuItem_deliverectPlu"
  | "menuItem_deliverectProductId"
  | "modifierOption_deliverectModifierId";

/**
 * Apply snooze/unsnooze only to rows in the **published** catalog for each vendor.
 * Products: prefer `deliverectPlu`, then `deliverectProductId === plu` when that id is in the snapshot.
 * Modifiers: `deliverectModifierId === plu` only when that id appears in the published snapshot.
 */
async function applyPluAvailability(
  plu: string,
  isAvailable: boolean,
  vendorIds: string[],
  scope: DeliverectSnoozePublishedScope
): Promise<{ matched: boolean; kind: MatchedKind | null; updated: number }> {
  if (vendorIds.length === 0) {
    return { matched: false, kind: null, updated: 0 };
  }

  let totalUpdated = 0;
  let kind: MatchedKind | null = null;

  for (const vendorId of vendorIds) {
    const pubProductIds = scope.productDeliverectIdsByVendor.get(vendorId);
    if (pubProductIds && pubProductIds.size > 0) {
      const idList = [...pubProductIds];

      const byDeliverectPlu = await prisma.menuItem.updateMany({
        where: {
          vendorId,
          deliverectPlu: plu,
          deliverectProductId: { in: idList },
        },
        data: { isAvailable },
      });
      if (byDeliverectPlu.count > 0) {
        totalUpdated += byDeliverectPlu.count;
        kind = "menuItem_deliverectPlu";
      }
    }
  }

  if (totalUpdated === 0) {
    for (const vendorId of vendorIds) {
      const pubProductIds = scope.productDeliverectIdsByVendor.get(vendorId);
      if (!pubProductIds?.has(plu)) continue;

      const byProductId = await prisma.menuItem.updateMany({
        where: { vendorId, deliverectProductId: plu },
        data: { isAvailable },
      });
      if (byProductId.count > 0) {
        totalUpdated += byProductId.count;
        kind = "menuItem_deliverectProductId";
      }
    }
  }

  if (totalUpdated === 0) {
    for (const vendorId of vendorIds) {
      const pubModIds = scope.modifierOptionDeliverectIdsByVendor.get(vendorId);
      if (!pubModIds?.has(plu)) continue;

      const mo = await prisma.modifierOption.updateMany({
        where: {
          deliverectModifierId: plu,
          modifierGroup: { vendorId },
        },
        data: { isAvailable },
      });
      if (mo.count > 0) {
        totalUpdated += mo.count;
        kind = "modifierOption_deliverectModifierId";
      }
    }
  }

  return {
    matched: totalUpdated > 0,
    kind,
    updated: totalUpdated,
  };
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = getDeliverectSignatureFromRequest(request);

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBody) as unknown;
  } catch {
    console.warn(LOG, "invalid JSON", { contentLength: rawBody.length });
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const unwrap = unwrapSnoozePayload(parsedJson);
  if (!unwrap.ok) {
    return NextResponse.json(unwrap.body, { status: unwrap.status });
  }
  const parsed = unwrap.object;

  const production = isDeliverectWebhookProduction();
  const { secret: verificationSecret, hasChannelLinkId } = resolveDeliverectWebhookVerificationSecret(
    parsed,
    production
  );

  console.log(LOG, "received", {
    channelLinkIdPresent: Boolean(nonEmptyStringField(parsed.channelLinkId) ?? extractChannelLinkIdSecret(parsed)),
    hasChannelLinkIdForHmac: hasChannelLinkId,
    operationCount: Array.isArray(parsed.operations) ? parsed.operations.length : 0,
  });

  if (!verificationSecret) {
    return NextResponse.json(
      {
        error: production
          ? "Webhook verification misconfigured: DELIVERECT_WEBHOOK_SECRET is missing"
          : "Webhook verification failed: channelLinkId not found in payload (required for staging/sandbox HMAC)",
      },
      { status: 401 }
    );
  }

  if (
    !verifyDeliverectSignature(rawBody, signature, verificationSecret, {
      nodeEnv: production ? "production" : "development",
      allowUnsignedDev: false,
    })
  ) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const channelLinkId =
    nonEmptyStringField(parsed.channelLinkId) ?? extractChannelLinkIdSecret(parsed) ?? null;

  if (!channelLinkId) {
    console.warn(LOG, "missing channelLinkId after verify; skipping scoped updates");
    return NextResponse.json({
      received: true,
      outcome: "missing_channel_link_id" as const,
      processedPlu: 0,
    });
  }

  const vendors = await prisma.vendor.findMany({
    where: { deliverectChannelLinkId: channelLinkId },
    select: { id: true },
  });
  const vendorIds = vendors.map((v) => v.id);

  if (vendorIds.length === 0) {
    console.warn(LOG, "no vendor for channelLinkId; skipping updates", { channelLinkId });
    return NextResponse.json({
      received: true,
      outcome: "vendor_not_found" as const,
      processedPlu: 0,
    });
  }

  const publishedScope = await loadDeliverectSnoozePublishedScope(vendorIds);

  const operations = parsed.operations;
  if (!Array.isArray(operations)) {
    console.warn(LOG, "operations missing or not an array; nothing to apply");
    return NextResponse.json({
      received: true,
      outcome: "no_operations" as const,
      processedPlu: 0,
    });
  }

  let processedPlu = 0;
  let unmatchedPlu = 0;

  for (let oi = 0; oi < operations.length; oi++) {
    const op = operations[oi];
    if (op === null || typeof op !== "object" || Array.isArray(op)) {
      console.warn(LOG, "skip malformed operation", { index: oi });
      continue;
    }
    const opRec = op as Record<string, unknown>;
    const action = parseAction(opRec.action);
    if (!action) {
      console.warn(LOG, "skip unknown action", { index: oi, action: opRec.action });
      continue;
    }
    const isAvailable = isAvailableForAction(action);
    const data = opRec.data;
    if (data === null || typeof data !== "object" || Array.isArray(data)) {
      console.warn(LOG, "skip operation with missing data object", { index: oi, action });
      continue;
    }
    const items = (data as Record<string, unknown>).items;
    if (!Array.isArray(items)) {
      console.warn(LOG, "skip operation with missing items array", { index: oi, action });
      continue;
    }

    for (let ii = 0; ii < items.length; ii++) {
      const row = items[ii];
      if (row === null || typeof row !== "object" || Array.isArray(row)) {
        continue;
      }
      const plu = nonEmptyStringField((row as Record<string, unknown>).plu);
      if (!plu) {
        console.warn(LOG, "skip item without plu", { operationIndex: oi, itemIndex: ii });
        continue;
      }

      try {
        const result = await applyPluAvailability(plu, isAvailable, vendorIds, publishedScope);
        if (result.matched) {
          processedPlu += 1;
          console.log(LOG, "update applied", {
            plu,
            matchedType: result.kind,
            action,
            updatedRows: result.updated,
            channelLinkId,
          });
        } else {
          unmatchedPlu += 1;
          console.warn(LOG, "unmatched plu", { plu, channelLinkId, action });
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error(LOG, "plu update failed (continuing)", { plu, channelLinkId, message });
      }
    }
  }

  console.log(LOG, "complete", {
    channelLinkId,
    vendorCount: vendorIds.length,
    processedPlu,
    unmatchedPlu,
    deliverectEnv: env.DELIVERECT_ENV ?? "(unset)",
  });

  return NextResponse.json({
    received: true,
    outcome: "processed" as const,
    processedPlu,
    unmatchedPlu,
  });
}
