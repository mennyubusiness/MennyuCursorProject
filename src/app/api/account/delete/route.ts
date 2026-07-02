import { NextResponse } from "next/server";
import { signOut } from "@/auth";
import { deleteUserAccount, requireAuthenticatedUserId } from "@/services/entity-deletion.service";

type DeleteAccountBody = {
  confirmation?: string;
};

export async function POST(request: Request) {
  const userId = await requireAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: DeleteAccountBody = {};
  try {
    body = (await request.json()) as DeleteAccountBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.confirmation?.trim().toUpperCase() !== "DELETE") {
    return NextResponse.json({ error: "Type DELETE to confirm account deletion." }, { status: 400 });
  }

  const result = await deleteUserAccount({ userId, actorUserId: userId });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, blockers: result.blockers ?? [] },
      { status: result.blockers ? 409 : 400 }
    );
  }

  await signOut({ redirect: false });

  return NextResponse.json({ ok: true, redirectTo: "/" });
}
