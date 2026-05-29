import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { CUSTOMER_SUPPORT_ISSUE_TYPES, customerSupportIssueSubmitSuccessMessage } from "@/domain/order-support-issue";
import { assertCustomerOrderAccess } from "@/lib/customer-order-access";
import {
  createCustomerSupportIssue,
  listCustomerSupportIssuesForOrder,
} from "@/services/order-support-issue.service";

const createBodySchema = z.object({
  issueType: z.enum(CUSTOMER_SUPPORT_ISSUE_TYPES),
  vendorOrderId: z.string().min(1).optional().nullable(),
  orderLineItemId: z.string().min(1).optional().nullable(),
  customerMessage: z.string().max(2000).optional().nullable(),
});

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await context.params;
  if (!orderId) {
    return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
  }

  const access = await assertCustomerOrderAccess(orderId, await headers());
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const issues = await listCustomerSupportIssuesForOrder(orderId);
  return NextResponse.json({ issues });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await context.params;
  if (!orderId) {
    return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
  }

  const access = await assertCustomerOrderAccess(orderId, await headers());
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const session = await auth();
  const result = await createCustomerSupportIssue({
    orderId,
    issueType: parsed.data.issueType,
    vendorOrderId: parsed.data.vendorOrderId ?? null,
    orderLineItemId: parsed.data.orderLineItemId ?? null,
    customerMessage: parsed.data.customerMessage ?? null,
    submittedByUserId: session?.user?.id ?? null,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.message, code: result.code },
      { status: result.status }
    );
  }

  return NextResponse.json({
    ok: true,
    issue: result.issue,
    message: customerSupportIssueSubmitSuccessMessage(parsed.data.issueType),
  });
}
