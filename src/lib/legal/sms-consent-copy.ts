/** Transactional SMS consent copy for A2P 10DLC (Open Order brand). */

export const SMS_CHECKOUT_OPT_IN_LABEL =
  "Send me transactional SMS updates for this order.";

export const SMS_ACCOUNT_OPT_IN_LABEL = "Send me transactional SMS updates.";

export const SMS_TRANSACTIONAL_MESSAGE_TYPES = [
  "Verification codes",
  "Order received confirmations",
  "Order preparing updates",
  "Ready-for-pickup alerts",
  "Cancellation notices",
  "Order issue notifications",
] as const;

/** Lowercase inline list for disclosure sentences. */
export const SMS_MESSAGE_TYPES_INLINE =
  "verification codes, order received confirmations, order preparing updates, ready-for-pickup alerts, cancellation notices, and order issue notifications";

export const SMS_TRANSACTIONAL_COMPLIANCE_DISCLOSURE =
  `Messages may include ${SMS_MESSAGE_TYPES_INLINE}. Message frequency varies. Message and data rates may apply. Carriers are not liable for delayed or undelivered messages. Reply STOP to opt out or HELP for help. View our Privacy Policy and Terms of Service.`;

/** Full checkbox label for public SMS consent page reference. */
export const SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL =
  `I agree to receive transactional SMS messages from Open Order at the phone number provided. Messages may include ${SMS_MESSAGE_TYPES_INLINE}. Message frequency varies. Message and data rates may apply. Carriers are not liable for delayed or undelivered messages. Reply STOP to opt out or HELP for help. View our Privacy Policy and Terms of Service.`;

/** Active SMS opt-in paths (group order join is not an SMS opt-in path). */
export const SMS_ACTIVE_OPT_IN_PATHS = [
  "Checkout — optional mobile number and SMS checkbox before placing an order",
  "Account phone / order updates — optional SMS checkbox in signed-in account settings",
  "START keyword — reply START to an Open Order SMS to re-subscribe after opting out",
] as const;
