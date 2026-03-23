/**
 * POST: Create a User (email/password) and optional VendorMembership.
 * Admin-only (ADMIN_SECRET). Use to bootstrap vendor dashboard access without legacy tokens.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdminApiRequestAuthorized } from "@/lib/admin-auth";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db";
import { VendorMembershipRole } from "@prisma/client";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  vendorId: z.string().min(1),
  role: z.nativeEnum(VendorMembershipRole).optional().default(VendorMembershipRole.staff),
});

export async function POST(request: NextRequest) {
  if (!(await isAdminApiRequestAuthorized(request))) {
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

  const { email, password, vendorId, role } = parsed.data;
  const emailNorm = email.toLowerCase().trim();

  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId.trim() }, select: { id: true } });
  if (!vendor) {
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  }

  const passwordHash = await hashPassword(password);

  try {
    const user = await prisma.user.create({
      data: {
        email: emailNorm,
        passwordHash,
        vendorMemberships: {
          create: { vendorId: vendor.id, role },
        },
      },
      select: { id: true, email: true },
    });
    return NextResponse.json({
      userId: user.id,
      email: user.email,
      vendorId: vendor.id,
      role,
      message: "User created. Vendor can sign in at /login.",
    });
  } catch (e: unknown) {
    const code = e && typeof e === "object" && "code" in e ? String((e as { code?: string }).code) : "";
    if (code === "P2002") {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }
    throw e;
  }
}
