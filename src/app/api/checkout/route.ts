import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { assertCartSessionAccess } from "@/lib/cart-session-access";
import { buildCustomerSessionCookieHeader } from "@/lib/customer-session";
import { createCustomerOrderAccessToken } from "@/lib/customer-order-access-token";
import {
  createCustomerSessionCookieForAccount,
  resolveCheckoutPhoneForOrder,
} from "@/lib/customer-checkout-phone-verification";
import { recordSmsOptIn } from "@/lib/sms-opt-out.service";
import { linkCheckoutCustomerAccountToUser } from "@/services/customer-account-link.service";
import { buildOrderAccessCookieHeader, getSessionIdFromRequest } from "@/lib/session";
import { RATE_LIMITS, rateLimitKeys } from "@/lib/rate-limit";
import { applyRateLimits, getClientIp } from "@/lib/rate-limit-http";
import { createOrderFromCart, OrderValidationError } from "@/services/order.service";
import { createPaymentIntent } from "@/services/payment.service";

const bodySchema = z
  .object({
    cartId: z.string(),
    customerPhone: z.string().optional().default(""),
    smsConsent: z.boolean().optional().default(false),
    customerEmail: z.string().email().optional(),
    tipCents: z.number().int().min(0),
    idempotencyKey: z.string().min(1),
    pickupMode: z.enum(["asap", "scheduled"]).optional().default("asap"),
    scheduledPickupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    scheduledPickupTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    groupCheckoutFingerprint: z.string().min(1).optional(),
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
  const rateLimitActorKey = getSessionIdFromRequest(request) ?? getClientIp(request);
  const limited = applyRateLimits([
    {
      key: rateLimitKeys.checkoutSession(rateLimitActorKey),
      ...RATE_LIMITS.checkoutSession,
    },
    {
      key: rateLimitKeys.checkoutIp(getClientIp(request)),
      ...RATE_LIMITS.checkoutIp,
    },
  ]);
  if (limited) return limited;

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const {
    cartId,
    customerPhone,
    smsConsent,
    customerEmail,
    tipCents,
    idempotencyKey,
    pickupMode,
    scheduledPickupDate,
    scheduledPickupTime,
    groupCheckoutFingerprint,
  } = parsed.data;

  const sessionId = getSessionIdFromRequest(request);
  const authSession = await auth();
  const access = await assertCartSessionAccess(cartId, sessionId, {
    authUserId: authSession?.user?.id ?? null,
    mode: "checkout",
  });
  if (!access.ok) {
    const code =
      access.error.includes("host")
        ? "GROUP_ORDER_HOST_CHECKOUT"
        : access.status === 401
          ? "SESSION_REQUIRED"
          : "CART_ACCESS_DENIED";
    return NextResponse.json({ error: access.error, code }, { status: access.status });
  }

  if (access.isGroupOrder && !groupCheckoutFingerprint?.trim()) {
    return NextResponse.json(
      {
        error: "Group checkout expired. Return to cart and try checkout again.",
        code: "GROUP_CHECKOUT_FINGERPRINT_REQUIRED",
      },
      { status: 400 }
    );
  }

  const phoneVerification = await resolveCheckoutPhoneForOrder(
    request,
    authSession?.user?.id ?? null,
    customerPhone,
    smsConsent
  );
  if (!phoneVerification.ok) {
    return NextResponse.json(
      { error: phoneVerification.error, code: phoneVerification.code },
      { status: phoneVerification.status }
    );
  }
  const submittedPhoneE164 = phoneVerification.phoneE164;

  if (smsConsent && submittedPhoneE164) {
    await recordSmsOptIn(submittedPhoneE164);
  }

  if (authSession?.user?.id && phoneVerification.customerAccountId) {
    await linkCheckoutCustomerAccountToUser({
      userId: authSession.user.id,
      customerAccountId: phoneVerification.customerAccountId,
      phoneE164: submittedPhoneE164,
    }).catch(() => undefined);
  }

  const groupOrderHostUserId = access.isGroupOrder ? authSession?.user?.id : undefined;

  let result;
  try {
    result = await createOrderFromCart({
      cartId,
      customerPhone: submittedPhoneE164,
      customerEmail: customerEmail ?? authSession?.user?.email ?? undefined,
      tipCents,
      idempotencyKey,
      pickupMode,
      scheduledPickupDate,
      scheduledPickupTime,
      groupCheckoutFingerprint: groupCheckoutFingerprint?.trim() ?? null,
      groupOrderHostUserId,
      mennyuSessionId: sessionId,
      customerAccountId: phoneVerification.customerAccountId,
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

  const orderAccessToken = createCustomerOrderAccessToken(result.order.id);
  const response = NextResponse.json({
    orderId: result.order.id,
    clientSecret,
    paymentIntentId,
    totalCents: result.order.totalCents,
    orderAccessToken,
  });
  response.headers.append("Set-Cookie", buildOrderAccessCookieHeader(orderAccessToken));
  if (phoneVerification.establishCustomerSession && phoneVerification.customerAccountId) {
    const sessionToken = await createCustomerSessionCookieForAccount(
      phoneVerification.customerAccountId
    );
    response.headers.append("Set-Cookie", buildCustomerSessionCookieHeader(sessionToken));
  }
  return response;
}
