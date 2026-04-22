export type AdminPayoutTransferRow = {
  id: string;
  paymentAllocationId: string;
  vendorOrderId: string;
  vendorId: string;
  destinationAccountId: string;
  amountCents: number;
  currency: string;
  status: string;
  blockedReason: string | null;
  stripeTransferId: string | null;
  idempotencyKey: string;
  batchKey: string | null;
  failureMessage: string | null;
  createdAt: string;
  submittedAt: string | null;
  failedAt: string | null;
  vendor: { id: string; name: string };
  vendorOrder: { id: string; orderId: string };
};

export type AdminTransferReversalRow = {
  id: string;
  vendorPayoutTransferId: string;
  vendorOrderId: string;
  orderId: string;
  refundAttemptId: string;
  amountCents: number;
  currency: string;
  status: string;
  stripeTransferReversalId: string | null;
  failureMessage: string | null;
  batchKey: string | null;
  createdAt: string;
  submittedAt: string | null;
  failedAt: string | null;
  vendorId: string;
  vendor: { id: string; name: string };
  vendorOrder: { id: string; orderId: string };
  order: { id: string };
};

export type AdminVendorOption = { id: string; name: string };
