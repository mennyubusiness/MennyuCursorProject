import { describe, expect, it } from "vitest";
import {
  buildSquareOAuthScopeCapabilities,
  evaluateSquareOAuthScopeCoverage,
  isSquareInsufficientPermissionsError,
  resolveSquareOAuthScopesForAuthorize,
  SQUARE_OAUTH_INJECTION_SCOPES,
  SQUARE_OAUTH_MINIMAL_DEBUG_SCOPES,
  SQUARE_OAUTH_SCOPES,
  SQUARE_OAUTH_SCOPE_RECONNECT_MESSAGE,
} from "@/lib/integrations/square/square-oauth-scopes";

describe("square oauth scopes", () => {
  it("includes catalog and order injection scopes in the default authorize set", () => {
    expect(SQUARE_OAUTH_SCOPES).toEqual(
      expect.arrayContaining([
        "MERCHANT_PROFILE_READ",
        "ITEMS_READ",
        "ORDERS_READ",
        "ORDERS_WRITE",
        "PAYMENTS_READ",
        "PAYMENTS_WRITE",
      ])
    );
  });

  it("uses full scopes for normal OAuth and minimal scopes only for debug minimal_scope", () => {
    expect(resolveSquareOAuthScopesForAuthorize()).toEqual(SQUARE_OAUTH_SCOPES);
    expect(resolveSquareOAuthScopesForAuthorize({ debug: true, minimalScope: true })).toEqual(
      SQUARE_OAUTH_MINIMAL_DEBUG_SCOPES
    );
    expect(resolveSquareOAuthScopesForAuthorize({ debug: true, minimalScope: false })).toEqual(
      SQUARE_OAUTH_SCOPES
    );
  });

  it("treats legacy connections without stored scopes as missing injection scopes", () => {
    const coverage = evaluateSquareOAuthScopeCoverage({
      authorizedScopes: [],
      permissionsVersion: 1,
    });

    expect(coverage.hasOrderInjectionScopes).toBe(false);
    expect(coverage.missingRequiredScopes).toEqual(expect.arrayContaining([...SQUARE_OAUTH_INJECTION_SCOPES]));
    expect(coverage.needsReconnectForInjection).toBe(true);
  });

  it("is injection-ready when ORDERS_WRITE and PAYMENTS_WRITE are authorized", () => {
    const coverage = evaluateSquareOAuthScopeCoverage({
      authorizedScopes: [...SQUARE_OAUTH_SCOPES],
      permissionsVersion: 2,
    });

    expect(coverage.hasOrderInjectionScopes).toBe(true);
    expect(coverage.missingRequiredScopes).toHaveLength(0);
  });

  it("detects insufficient permission API errors", () => {
    expect(
      isSquareInsufficientPermissionsError(
        "The merchant has not given your application sufficient permissions... required scopes: ORDERS_WRITE"
      )
    ).toBe(true);
    expect(isSquareInsufficientPermissionsError("Square 503 unavailable")).toBe(false);
  });

  it("stores expanded scopes after reconnect", () => {
    const stored = buildSquareOAuthScopeCapabilities({
      authorizedScopes: [...SQUARE_OAUTH_SCOPES],
    });

    expect(stored.authorizedScopes).toEqual([...SQUARE_OAUTH_SCOPES]);
    expect(stored.missingRequiredScopes).toHaveLength(0);
    expect(stored.permissionsVersion).toBe(2);
    expect(SQUARE_OAUTH_SCOPE_RECONNECT_MESSAGE).toMatch(/Reconnect Square/i);
  });
});
