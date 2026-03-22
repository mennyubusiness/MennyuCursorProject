/**
 * Deliverect menu payload normalization (Phase 1A). No live DB writes.
 */

export {
  normalizeDeliverectMenuToCanonical,
  type NormalizeDeliverectMenuInput,
  type NormalizeDeliverectMenuResult,
} from "./normalize";

export {
  isRecord,
  asString,
  asNumber,
  coerceInt,
  firstDeliverectId,
} from "./raw-helpers";

export {
  runPhase1aDeliverectMenuImport,
  type Phase1aMenuImportResult,
} from "./phase1a-pipeline";
