/**
 * Deliverect Busy Mode webhook — acknowledged; full POS busy/pause behavior not implemented yet.
 * HMAC matches other Deliverect inbound webhooks.
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyDeliverectInboundWebhookJson } from "@/integrations/deliverect/deliverect-inbound-webhook-verify";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const v = await verifyDeliverectInboundWebhookJson(request, rawBody);
  if (!v.ok) return v.response;
  console.info("[DELIVERECT BUSY MODE WEBHOOK] received; not_implemented_v1");
  return NextResponse.json({
    received: true,
    handling: "not_implemented_v1",
  });
}
