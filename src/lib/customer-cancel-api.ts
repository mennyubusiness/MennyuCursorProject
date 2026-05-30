import { NextResponse } from "next/server";

export const CUSTOMER_CANCEL_UNSUPPORTED_CODE = "CUSTOMER_CANCEL_UNSUPPORTED";

export const CUSTOMER_CANCEL_UNSUPPORTED_MESSAGE =
  'Direct order cancellation is not available. Use "Need help with this order?" on your order page to submit a cancellation request.';

/** Legacy customer cancel routes return 410 — cancellation requests go through OrderHelpSection. */
export function customerCancelUnsupportedResponse() {
  return NextResponse.json(
    {
      error: CUSTOMER_CANCEL_UNSUPPORTED_MESSAGE,
      code: CUSTOMER_CANCEL_UNSUPPORTED_CODE,
    },
    { status: 410 }
  );
}
