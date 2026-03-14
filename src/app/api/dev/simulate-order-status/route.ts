import { NextResponse } from "next/server";
import {
  simulateVendorOrderTransition,
  type SimulatorTargetState,
} from "@/services/dev-order-simulator.service";

const VALID_TARGETS: SimulatorTargetState[] = [
  "sent",
  "confirmed",
  "accepted",
  "preparing",
  "ready",
  "completed",
  "cancelled",
  "failed",
];

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const obj = body && typeof body === "object" ? body as Record<string, unknown> : null;
  const vendorOrderId = typeof obj?.vendorOrderId === "string" ? obj.vendorOrderId : null;
  const targetState = typeof obj?.targetState === "string" ? obj.targetState : null;

  if (!vendorOrderId || !targetState) {
    return NextResponse.json(
      { error: "Missing or invalid vendorOrderId or targetState" },
      { status: 400 }
    );
  }

  if (!VALID_TARGETS.includes(targetState as SimulatorTargetState)) {
    return NextResponse.json(
      { error: `Invalid targetState. Allowed: ${VALID_TARGETS.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const result = await simulateVendorOrderTransition(
      vendorOrderId,
      targetState as SimulatorTargetState
    );

    if (result.success) {
      return NextResponse.json(result);
    }

    if (result.code === "NOT_FOUND") {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status: 400 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
