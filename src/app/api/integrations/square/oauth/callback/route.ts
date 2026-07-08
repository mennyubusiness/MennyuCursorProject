import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { canManageVendor } from "@/lib/permissions";
import { getPublicSiteOrigin } from "@/lib/public-site-url";
import { completeSquareOAuthForVendor } from "@/lib/integrations/square/square-connection.service";
import {
  buildSquareIntegrationPageUrl,
  buildSquareOAuthErrorRedirect,
  mapSquareApiErrorToOAuthCode,
  normalizeSquareOAuthErrorCode,
} from "@/lib/integrations/square/square-oauth-errors";
import { verifySquareOAuthState, SquareOAuthStateError } from "@/lib/integrations/square/square-oauth-state";
import {
  consumeSquareOAuthStateNonce,
  pruneExpiredSquareOAuthStateNonces,
  SquareOAuthStateReplayError,
} from "@/lib/integrations/square/square-oauth-nonce.service";
import { SquareApiError } from "@/lib/integrations/square/square-api.client";

export const dynamic = "force-dynamic";

function logSquareOAuthCallback(event: string, details: Record<string, unknown>) {
  console.info(JSON.stringify({ event, ...details }));
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const squareError = url.searchParams.get("error");
  const origin = await getPublicSiteOrigin();

  let vendorId: string | null = null;

  if (squareError) {
    logSquareOAuthCallback("square_oauth_callback_error", {
      squareError,
      hasState: Boolean(state?.trim()),
    });
    if (state?.trim()) {
      try {
        vendorId = verifySquareOAuthState(state).vendorId;
      } catch {
        /* redirect without vendor context */
      }
    }
    const errorCode = normalizeSquareOAuthErrorCode(squareError);
    return NextResponse.redirect(buildSquareOAuthErrorRedirect(origin, vendorId, errorCode));
  }

  if (!code?.trim() || !state?.trim()) {
    logSquareOAuthCallback("square_oauth_callback_missing_params", {
      hasCode: Boolean(code?.trim()),
      hasState: Boolean(state?.trim()),
    });
    return NextResponse.redirect(
      buildSquareOAuthErrorRedirect(origin, null, "missing_code_or_state")
    );
  }

  let userId: string;
  try {
    const payload = verifySquareOAuthState(state);
    vendorId = payload.vendorId;
    userId = payload.userId;
    await pruneExpiredSquareOAuthStateNonces();
    await consumeSquareOAuthStateNonce({
      nonce: payload.nonce,
      vendorId: payload.vendorId,
      userId: payload.userId,
      expiresAt: new Date(payload.exp * 1000),
    });
  } catch (e) {
    const errorCode =
      e instanceof SquareOAuthStateReplayError
        ? "oauth_state_reused"
        : e instanceof SquareOAuthStateError
          ? normalizeSquareOAuthErrorCode(e.message)
          : e instanceof Error
            ? normalizeSquareOAuthErrorCode(e.message)
            : "invalid_oauth_state";
    if (e instanceof SquareOAuthStateError && e.vendorId) {
      vendorId = e.vendorId;
    }
    logSquareOAuthCallback("square_oauth_callback_state_rejected", {
      errorCode,
      vendorId,
    });
    return NextResponse.redirect(buildSquareOAuthErrorRedirect(origin, vendorId, errorCode));
  }

  const session = await auth();
  if (!session?.user?.id || session.user.id !== userId) {
    return NextResponse.redirect(
      `${origin}/login?returnTo=${encodeURIComponent(`/vendor/${vendorId}/integrations/square`)}`
    );
  }
  if (!(await canManageVendor(userId, vendorId))) {
    return NextResponse.redirect(buildSquareOAuthErrorRedirect(origin, vendorId, "forbidden"));
  }

  try {
    const result = await completeSquareOAuthForVendor({ vendorId, code: code.trim() });
    logSquareOAuthCallback("square_oauth_callback_success", {
      vendorId,
      needsLocationSelection: result.needsLocationSelection,
      connectionId: result.connectionId,
    });
    const dest = result.needsLocationSelection
      ? buildSquareIntegrationPageUrl(origin, vendorId, { select_location: "1" })
      : buildSquareIntegrationPageUrl(origin, vendorId, { square_connected: "1" });
    return NextResponse.redirect(dest);
  } catch (e) {
    // SquareApiError messages may include provider detail — map to a safe redirect code.
    const errorCode =
      e instanceof SquareApiError
        ? mapSquareApiErrorToOAuthCode(e.message)
        : e instanceof Error
          ? normalizeSquareOAuthErrorCode(e.message)
          : "oauth_failed";
    logSquareOAuthCallback("square_oauth_callback_failed", {
      vendorId,
      errorCode,
      ...(e instanceof SquareApiError ? { squareStatus: e.status } : {}),
    });
    return NextResponse.redirect(buildSquareOAuthErrorRedirect(origin, vendorId, errorCode));
  }
}
