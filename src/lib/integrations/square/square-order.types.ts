/** Square Orders API request/response shapes (subset used by Open Order). */

export type SquareMoney = {
  amount: number;
  currency: string;
};

export type SquareOrderLineItemModifier = {
  catalog_object_id: string;
  quantity: string;
};

export type SquareOrderLineItem = {
  quantity: string;
  catalog_object_id: string;
  note?: string;
  modifiers?: SquareOrderLineItemModifier[];
};

export type SquarePickupFulfillment = {
  type: "PICKUP";
  state: "PROPOSED";
  pickup_details: {
    recipient?: {
      display_name?: string;
    };
    note?: string;
    schedule_type?: "ASAP";
  };
};

export type SquareCreateOrderRequest = {
  idempotency_key: string;
  order: {
    location_id: string;
    reference_id?: string;
    source?: { name: string };
    line_items: SquareOrderLineItem[];
    fulfillments?: SquarePickupFulfillment[];
    state?: "OPEN";
  };
};

export type SquareOrder = {
  id: string;
  location_id?: string;
  state?: string;
  reference_id?: string;
  total_money?: SquareMoney;
  line_items?: SquareOrderLineItem[];
};

export type SquareCreateOrderResponse = {
  order?: SquareOrder;
  errors?: Array<{ code?: string; detail?: string; category?: string }>;
};

export type SquareExternalPaymentDetails = {
  type: "OTHER" | "BANK_TRANSFER" | "CHECK" | "CARD" | "SQUARE_GIFT_CARD";
  source: string;
};

export type SquareCreateExternalPaymentRequest = {
  idempotency_key: string;
  source_id: "EXTERNAL";
  order_id: string;
  amount_money: SquareMoney;
  external_details: SquareExternalPaymentDetails;
  autocomplete?: boolean;
};

export type SquarePayment = {
  id?: string;
  order_id?: string;
  status?: string;
};

export type SquareCreatePaymentResponse = {
  payment?: SquarePayment;
  errors?: Array<{ code?: string; detail?: string; category?: string }>;
};

export type SquareOrderSubmitAudit = {
  createOrderRequest: SquareCreateOrderRequest;
  createOrderResponse?: SquareCreateOrderResponse;
  createPaymentRequest?: SquareCreateExternalPaymentRequest;
  createPaymentResponse?: SquareCreatePaymentResponse;
};
