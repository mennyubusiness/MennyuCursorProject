import { PrismaClient } from "@prisma/client";

const ORDER_ID = "cmpynlihw0002lj67opz3erkh";

const prisma = new PrismaClient();

async function main() {
  const order = await prisma.order.findUnique({
    where: { id: ORDER_ID },
    select: {
      id: true,
      totalCents: true,
      totalRefundedCents: true,
      paymentRefundStatus: true,
      updatedAt: true,
      stripePaymentIntentId: true,
    },
  });

  const orderRefunds = await prisma.orderRefund.findMany({
    where: { orderId: ORDER_ID },
    orderBy: { createdAt: "asc" },
  });

  const refundAttempts = await prisma.refundAttempt.findMany({
    where: { orderId: ORDER_ID },
    orderBy: { createdAt: "asc" },
  });

  console.log("=== ORDER ===");
  console.log(JSON.stringify(order, null, 2));
  console.log("\n=== ORDER REFUNDS (" + orderRefunds.length + ") ===");
  console.log(JSON.stringify(orderRefunds, null, 2));
  console.log("\n=== REFUND ATTEMPTS (" + refundAttempts.length + ") ===");
  console.log(JSON.stringify(refundAttempts, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
