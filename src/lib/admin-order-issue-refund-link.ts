/** Client-safe context when opening a refund modal from an OrderIssue. */
export type LinkedIssueRefundContext = {
  issueId: string;
  issueType: string;
  issueTypeLabel: string;
  customerMessage: string | null;
  vendorOrderId: string | null;
  vendorName: string | null;
  orderLineItemId: string | null;
  lineItemName: string | null;
};
