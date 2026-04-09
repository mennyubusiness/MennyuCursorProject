/**
 * Deliverect occasionally wraps webhook bodies as `[{ ... }]`; normalize to a single object for HMAC + parsing.
 */
export type UnwrapDeliverectObjectOk = { ok: true; object: Record<string, unknown> };
export type UnwrapDeliverectObjectErr = { ok: false; status: number; body: Record<string, unknown> };

export function unwrapDeliverectSingleObjectPayload(parsed: unknown): UnwrapDeliverectObjectOk | UnwrapDeliverectObjectErr {
  if (parsed === null || typeof parsed !== "object") {
    return {
      ok: false,
      status: 400,
      body: { error: "Webhook body must be a JSON object or single-element array", code: "INVALID_JSON_SHAPE" },
    };
  }
  if (Array.isArray(parsed)) {
    if (parsed.length !== 1) {
      return {
        ok: false,
        status: 400,
        body: {
          error: "Expected one JSON object or a single-element array",
          code: "INVALID_ARRAY_WRAPPER",
        },
      };
    }
    const only = parsed[0];
    if (only === null || typeof only !== "object" || Array.isArray(only)) {
      return {
        ok: false,
        status: 400,
        body: { error: "Array must contain one object", code: "INVALID_ARRAY_ELEMENT" },
      };
    }
    return { ok: true, object: only as Record<string, unknown> };
  }
  return { ok: true, object: parsed as Record<string, unknown> };
}
