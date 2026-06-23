/** Public Twilio reviewer screenshot (static asset in /public/twilio). */
export const TWILIO_CONSENT_FORM_SCREENSHOT_URL =
  "https://openorderco.com/twilio/consent-form.png";

/** Same asset via site-relative path for embedded images in-app. */
export const TWILIO_CONSENT_FORM_SCREENSHOT_PATH = "/twilio/consent-form.png";

export const SMS_PHONE_NUMBER_LABEL = "Phone Number";
export const SMS_PHONE_OPTIONAL_TAG = "Optional";

/** Active transactional opt-in checkbox disclosure (TCPA / Twilio layout). */
export const SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL =
  "By checking this box you agree to receive Transactional SMS communication regarding order updates, account notifications, and verification codes from Open Order. Message frequency may vary. Message and data rates may apply. Reply HELP for help or STOP to opt-out.";

/** @deprecated Use SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL in UI. Kept for migration reference. */
export const SMS_CHECKOUT_OPT_IN_LABEL =
  "Send me transactional SMS updates for this order.";

/** @deprecated Use SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL in UI. Kept for migration reference. */
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

/** @deprecated Disclosure is now in SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL; links render below checkboxes. */
export const SMS_TRANSACTIONAL_COMPLIANCE_DISCLOSURE =
  `Messages may include ${SMS_MESSAGE_TYPES_INLINE}. Message frequency varies. Message and data rates may apply. Carriers are not liable for delayed or undelivered messages. Reply STOP to opt out or HELP for help. View our Privacy Policy and Terms of Service.`;

/** Active SMS opt-in paths (group order join is not an SMS opt-in path). */
export const SMS_ACTIVE_OPT_IN_PATHS = [
  "Checkout — optional phone number and transactional SMS checkbox before placing an order",
  "Account phone / order updates — optional transactional SMS checkbox in signed-in account settings",
  "START keyword — reply START to an Open Order SMS to re-subscribe after opting out",
] as const;
