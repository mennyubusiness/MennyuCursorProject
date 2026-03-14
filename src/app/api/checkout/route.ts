import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createOrderFromCart, OrderValidationError } from "@/services/order.service";
import { createPaymentIntent } from "@/services/payment.service";

const bodySchema = z.object({
  cartId: z.string(),
  customerPhone: z.string().min(1),
  customerEmail: z.string().email().optional(),
  tipCents: z.number().int().min(0),
  idempotencyKey: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { cartId, customerPhone, customerEmail, tipCents, idempotencyKey } = parsed.data;

  let result;
  try {
    result = await createOrderFromCart({
      cartId,
      customerPhone,
      customerEmail,
      tipCents,
      idempotencyKey,
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
