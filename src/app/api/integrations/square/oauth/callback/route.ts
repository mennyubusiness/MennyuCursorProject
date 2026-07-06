import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { canManageVendor } from "@/lib/permissions";
import { getPublicSiteOrigin } from "@/lib/public-site-url";
import { completeSquareOAuthForVendor } from "@/lib/integrations/square/square-connection.service";
import { verifySquareOAuthState } from "@/lib/integrations/square/square-oauth-state";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const origin = await getPublicSiteOrigin();

  if (error) {
    return NextResponse.redirect(
      `${origin}/vendor?square_error=${encodeURIComponent(error)}`
    );
  }

  if (!code?.trim() || !state?.trim()) {
    return NextResponse.redirect(`${origin}/vendor?square_error=missing_code_or_state`);
  }

  let vendorId: string;
  let userId: string;
  try {
    const payload = verifySquareOAuthState(state);
    vendorId = payload.vendorId;
    userId = payload.userId;
  } catch {
    return NextResponse.redirect(`${origin}/vendor?square_error=invalid_oauth_state`);
  }

  const session = await auth();
  if (!session?.user?.id || session.user.id !== userId) {
    return NextResponse.redirect(
      `${origin}/login?returnTo=${encodeURIComponent(`/vendor/${vendorId}/integrations/square`)}`
    );
  }
  if (!(await canManageVendor(userId, vendorId))) {
    return NextResponse.redirect(`${origin}/vendor?square_error=forbidden`);
  }

  try {
    const result = await completeSquareOAuthForVendor({ vendorId, code: code.trim() });
    const dest = result.needsLocationSelection
      ? `/vendor/${vendorId}/integrations/square?select_location=1`
      : `/vendor/${vendorId}/integrations/square?square_connected=1`;
    return NextResponse.redirect(`${origin}${dest}`);
  } catch (e) {
    const message = e instanceof Error ? e.message : "oauth_failed";
    return NextResponse.redirect(
      `${origin}/vendor/${vendorId}/integrations/square?square_error=${encodeURIComponent(message)}`
    );
  }
}
