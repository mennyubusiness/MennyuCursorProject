import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { canManageVendor } from "@/lib/permissions";
import {
  assertSquareOAuthConfigured,
  buildSquareAuthorizationUrl,
  getSquareConfigSnapshot,
  SQUARE_OAUTH_SCOPES,
} from "@/lib/integrations/square/square-config";
import { signSquareOAuthState } from "@/lib/integrations/square/square-oauth-state";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ vendorId: string }> }
) {
  const { vendorId } = await context.params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!(await canManageVendor(userId, vendorId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const snap = getSquareConfigSnapshot();
  if (!snap.enabled) {
    return NextResponse.json(
      {
        error: snap.configured
          ? "Square integration is not enabled. Set ENABLE_SQUARE_INTEGRATION=true in production."
          : "Square OAuth is not configured for this environment.",
      },
      { status: 503 }
    );
  }

  try {
    assertSquareOAuthConfigured();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Square OAuth unavailable" },
      { status: 503 }
    );
  }

  const state = signSquareOAuthState(vendorId, userId);
  const authorizeUrl = buildSquareAuthorizationUrl({ state });
  const parsedAuthorizeUrl = new URL(authorizeUrl);
  const cfg = assertSquareOAuthConfigured();

  console.info(
    JSON.stringify({
      event: "square_oauth_start_redirect",
      authorizeHost: parsedAuthorizeUrl.hostname,
      redirectUri: cfg.redirectUrl,
      environment: cfg.environment,
      vendorId,
    })
  );

  if (request.nextUrl.searchParams.get("debug") === "1") {
    return NextResponse.json({
      authorizeUrlHost: parsedAuthorizeUrl.hostname,
      redirectUri: cfg.redirectUrl,
      environment: cfg.environment,
      scopes: SQUARE_OAUTH_SCOPES.join(" "),
      hasState: Boolean(state?.trim()),
    });
  }

  return NextResponse.redirect(authorizeUrl);
}
