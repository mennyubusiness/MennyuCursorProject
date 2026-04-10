import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { createOrderFromCart, OrderValidationError } from "@/services/order.service";
import { createPaymentIntent } from "@/services/payment.service";

const bodySchema = z
  .object({
    cartId: z.string(),
    customerPhone: z.string().min(1),
    customerEmail: z.string().email().optional(),
    tipCents: z.number().int().min(0),
    idempotencyKey: z.string().min(1),
    pickupMode: z.enum(["asap", "scheduled"]).optional().default("asap"),
    scheduledPickupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    scheduledPickupTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.pickupMode === "scheduled") {
      if (!data.scheduledPickupDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "scheduledPickupDate is required for scheduled pickup",
          path: ["scheduledPickupDate"],
        });
      }
      if (!data.scheduledPickupTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "scheduledPickupTime is required for scheduled pickup",
          path: ["scheduledPickupTime"],
        });
      }
    }
  });

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const {
    cartId,
    customerPhone,
    customerEmail,
    tipCents,
    idempotencyKey,
    pickupMode,
    scheduledPickupDate,
    scheduledPickupTime,
  } = parsed.data;

  const authSession = await auth();
  const groupSession = await prisma.groupOrderSession.findUnique({
    where: { cartId },
    select: { hostUserId: true },
  });
  let groupOrderHostUserId: string | undefined;
  if (groupSession) {
    const uid = authSession?.user?.id;
    if (!uid || uid !== groupSession.hostUserId) {
      return NextResponse.json(
        { error: "Only the host can check out a group order.", code: "GROUP_ORDER_HOST_CHECKOUT" },
        { status: 403 }
      );
    }
    groupOrderHostUserId = uid;
  }

  let result;
  try {
    result = await createOrderFromCart({
      cartId,
      customerPhone,
      customerEmail,
      tipCents,
      idempotencyKey,
      pickupMode,
      scheduledPickupDate,
      scheduledPickupTime,
      groupOrderHostUserId,
    });
  } catch (err) {
    if (err instanceof OrderValidationError) {
      return NextResponse.json(
        {
          error: err.message,
          code: err.code,
          ...(err.details && {
            cartItemId: err.details.cartItemId,
            menuItemId: err.details.menuItemId,
            menuItemName: err.details.menuItemName,
          }),
        },
        { status: 400 }
      );
    }
    throw err;
  }
  if (!result) {
    return NextResponse.json({ error: "Order creation failed" }, { status: 400 });
  }

  const { clientSecret, paymentIntentId } = await createPaymentIntent(
    result.order.id,
    result.order.totalCents,
    idempotencyKey
  );

  return NextResponse.json({
    orderId: result.order.id,
    clientSecret,
    paymentIntentId,
    totalCents: result.order.totalCents,
  });
}
