import { NextResponse } from "next/server";
import { assertPodApiAccess } from "@/lib/permissions";
import { searchVendorsForPodInvite } from "@/services/pod-vendor-search.service";

export async function GET(
  request: Request,
  context: { params: Promise<{ podId: string }> }
) {
  const { podId } = await context.params;
  if (!podId) return NextResponse.json({ error: "Missing podId" }, { status: 400 });

  const gate = await assertPodApiAccess(request, podId);
  if (!gate.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: gate.status });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const result = await searchVendorsForPodInvite(podId, q);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ results: result.results });
}
