/**
 * POST: Create or promote a platform admin (`User.isPlatformAdmin`).
 *
 * **Authorization:** ADMIN_SECRET cookie / `?admin=` only (or dev open) — **not** session.
 * This avoids a compromised password-only account granting itself admin.
 *
 * Body: `{ "email": "you@company.com", "password"?: "..." }`
 * - User exists → set `isPlatformAdmin: true`
 * - User missing → require `password` (min 8) to create user + flag
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db";
import { isAdminBootstrapSecretAuthorized } from "@/lib/admin-auth";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200).optional(),
});

export async function POST(request: NextRequest) {
  if (!isAdminBootstrapSecretAuthorized(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const emailNorm = parsed.data.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({
    where: { email: emailNorm },
    select: { id: true, isPlatformAdmin: true },
  });

  if (existing) {
    if (existing.isPlatformAdmin) {
      return NextResponse.json({ ok: true, action: "already_admin" as const, userId: existing.id });
    }
    await prisma.user.update({
      where: { id: existing.id },
      data: { isPlatformAdmin: true },
    });
    return NextResponse.json({ ok: true, action: "promoted" as const, userId: existing.id });
  }

  const pwd = parsed.data.password;
  if (!pwd) {
    return NextResponse.json(
      {
        error: "No user with that email. Pass password (min 8 characters) to create the account.",
        code: "NEED_PASSWORD_FOR_CREATE",
      },
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(pwd);
  const user = await prisma.user.create({
    data: {
      email: emailNorm,
      passwordHash,
      isPlatformAdmin: true,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, action: "created" as const, userId: user.id });
}
