/**
 * Deliverect payment update webhook — acknowledged; payment status sync from Deliverect not implemented yet.
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyDeliverectInboundWebhookJson } from "@/integrations/deliverect/deliverect-inbound-webhook-verify";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const v = await verifyDeliverectInboundWebhookJson(request, rawBody);
  if (!v.ok) return v.response;
  console.info("[DELIVERECT PAYMENT WEBHOOK] received; not_implemented_v1");
  return NextResponse.json({ received: true, handling: "not_implemented_v1" });
}
