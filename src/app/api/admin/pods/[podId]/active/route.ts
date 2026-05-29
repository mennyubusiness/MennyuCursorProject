/**
 * PATCH body: { isActive: boolean }
 * Updates Pod.isActive. No schema change; uses existing field.
 */
import { NextResponse } from "next/server";
import { isAdminApiRequestAuthorized } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ podId: string }> }
) {
  if (!(await isAdminApiRequestAuthorized(request))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { podId } = await context.params;
  if (!podId) {
    return NextResponse.json({ error: "Missing podId" }, { status: 400 });
  }

  let body: { isActive?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body.isActive !== "boolean") {
    return NextResponse.json({ error: "isActive must be boolean" }, { status: 400 });
  }

  const pod = await prisma.pod.findUnique({ where: { id: podId } });
  if (!pod) {
    return NextResponse.json({ error: "Pod not found" }, { status: 404 });
  }

  await prisma.pod.update({
    where: { id: podId },
    data: { isActive: body.isActive },
  });

  return NextResponse.json({ ok: true, isActive: body.isActive });
}
