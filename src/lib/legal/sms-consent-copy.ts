/** Transactional SMS consent copy for A2P 10DLC (OpenOrder brand in compliance text). */

export const SMS_CHECKOUT_OPT_IN_LABEL =
  "Send me transactional SMS updates for this order.";

export const SMS_ACCOUNT_OPT_IN_LABEL = "Send me transactional SMS updates.";

export const SMS_TRANSACTIONAL_COMPLIANCE_DISCLOSURE =
  "Messages may include verification codes, order confirmations, order status updates, pickup-ready alerts, cancellation notices, completed-order notices, and order issue notices. Message frequency varies. Message and data rates may apply. Carriers are not liable for delayed or undelivered messages. Reply STOP to opt out or HELP for help. View our Privacy Policy and Terms of Service.";

/** Full checkbox label for public SMS consent page and non-checkout flows. */
export const SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL =
  "I agree to receive transactional SMS messages from OpenOrder at the phone number provided. Messages may include verification codes, order confirmations, order status updates, pickup-ready alerts, cancellation notices, completed-order notices, and order issue notices. Message frequency varies. Message and data rates may apply. Carriers are not liable for delayed or undelivered messages. Reply STOP to opt out or HELP for help. View our Privacy Policy and Terms of Service.";

export const SMS_TRANSACTIONAL_MESSAGE_TYPES = [
  "Verification codes",
  "Order confirmations",
  "Order status updates",
  "Pickup-ready alerts",
  "Cancellation notices",
  "Completed-order notices",
  "Order issue notices",
] as const;

export const SMS_OPT_IN_LOCATIONS = [
  "Account phone number settings",
  "Checkout (mobile number before placing an order)",
  "Group order join (mobile number when joining a shared cart)",
] as const;
