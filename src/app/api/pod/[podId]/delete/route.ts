import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canDeletePod, deletePodProfile } from "@/services/entity-deletion.service";

type DeletePodBody = {
  confirmation?: string;
  acknowledgeActiveVendors?: boolean;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ podId: string }> }
) {
  const { podId } = await context.params;
  if (!podId) {
    return NextResponse.json({ error: "Missing podId" }, { status: 400 });
  }

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await canDeletePod(userId, podId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: DeletePodBody = {};
  try {
    body = (await request.json()) as DeletePodBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.confirmation?.trim().toUpperCase() !== "DELETE") {
    return NextResponse.json({ error: "Type DELETE to confirm pod deletion." }, { status: 400 });
  }

  const result = await deletePodProfile({
    podId,
    actorUserId: userId,
    acknowledgeActiveVendors: body.acknowledgeActiveVendors === true,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, blockers: result.blockers ?? [] },
      { status: result.blockers ? 409 : 400 }
    );
  }

  return NextResponse.json({ ok: true, redirectTo: "/account" });
}
