import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const attempts = await prisma.refundAttempt.findMany({
    where: {
      dismissedAsLegacyAt: null,
      status: { in: ["attempted", "failed"] },
      orderRefund: null,
    },
    include: {
      order: {
        select: {
          id: true,
          totalCents: true,
          totalRefundedCents: true,
          paymentRefundStatus: true,
          stripePaymentIntentId: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  console.log(`Found ${attempts.length} non-dismissed orphaned attempts (attempted/failed, no OrderRefund)`);

  for (const a of attempts) {
    const orderRefunds = await prisma.orderRefund.findMany({
      where: { orderId: a.orderId },
      select: {
        id: true,
        amountCents: true,
        status: true,
        stripeRefundId: true,
        refundAttemptId: true,
        createdAt: true,
        completedAt: true,
      },
    });
    console.log(
      JSON.stringify(
        {
          attemptId: a.id,
          orderId: a.orderId,
          attemptStatus: a.status,
          amountCents: a.amountCents,
          stripeRefundId: a.stripeRefundId,
          idempotencyKey: a.idempotencyKey,
          failureCode: a.failureCode,
          failureMessage: a.failureMessage?.slice(0, 200) ?? null,
          createdAt: a.createdAt,
          updatedAt: a.updatedAt,
          orderTotalCents: a.order.totalCents,
          orderTotalRefundedCents: a.order.totalRefundedCents,
          paymentRefundStatus: a.order.paymentRefundStatus,
          stripePaymentIntentId: a.order.stripePaymentIntentId,
          orderRefundCount: orderRefunds.length,
          orderRefunds,
        },
        null,
        2
      )
    );
    console.log("---");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
