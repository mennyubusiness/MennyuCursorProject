/**
 * Deliverect POS status → Open Order operational mapping.
 * Implementation lives in integrations; re-exported here for shared imports.
 */
export {
  DELIVERECT_MAPPED_NUMERIC_CODES,
  interpretDeliverectWebhookFlat,
  mapDeliverectStatusCodeToMennyuUpdate,
  type DeliverectMennyuOperationalMapping,
  type DeliverectStatusInterpretation,
} from "@/integrations/deliverect/deliverect-status-map";
