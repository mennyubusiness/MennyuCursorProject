"use server";

import { revalidatePath } from "next/cache";
import {
  RegistrationIntent,
  PodMembershipRole,
  VendorMembershipRole,
  AccountOnboardingStatus,
} from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  ACCOUNT_SETUP_CUSTOMER_PATH,
  ACCOUNT_SETUP_POD_PATH,
  ACCOUNT_SETUP_VENDOR_PATH,
} from "@/lib/auth/account-paths";
import { uniquePodSlugFromName, uniqueVendorSlugFromName } from "@/lib/slug-server";

async function requireUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function setRegistrationRole(
  intent: RegistrationIntent
): Promise<ActionResult & { nextPath?: string }> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Not signed in." };

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { registrationIntent: true, needsAccountRoleSelection: true },
  });
  if (existing?.registrationIntent) {
    return { ok: false, error: "You’ve already chosen an account type." };
  }
  if (!existing?.needsAccountRoleSelection) {
    return { ok: false, error: "Account setup is not available for this session." };
  }

  const nextPath =
    intent === RegistrationIntent.customer
      ? ACCOUNT_SETUP_CUSTOMER_PATH
      : intent === RegistrationIntent.vendor
        ? ACCOUNT_SETUP_VENDOR_PATH
        : ACCOUNT_SETUP_POD_PATH;

  await prisma.user.update({
    where: { id: userId },
    data: {
      registrationIntent: intent,
      needsAccountRoleSelection: false,
    },
  });
  revalidatePath("/account");
  return { ok: true, nextPath };
}

export async function saveCustomerProfile(input: {
  firstName: string;
  lastName: string;
  phone?: string;
}): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Not signed in." };

  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { registrationIntent: true },
  });
  if (u?.registrationIntent !== RegistrationIntent.customer) {
    return { ok: false, error: "This form is only for customer accounts." };
  }

  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const phone = input.phone?.trim() || null;
  if (!firstName || !lastName) {
    return { ok: false, error: "First and last name are required." };
  }

  await prisma.$transaction([
    prisma.customerProfile.upsert({
      where: { userId },
      create: { userId, firstName, lastName, phone },
      update: { firstName, lastName, phone },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { name: `${firstName} ${lastName}`.trim() },
    }),
  ]);

  revalidatePath("/account");
  return { ok: true };
}

export async function createVendorProfile(input: {
  businessName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  cuisineCategory: string;
  posType: string;
  description?: string;
  /** City / area — optional onboarding field */
  locationSummary?: string;
}): Promise<ActionResult & { vendorId?: string }> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Not signed in." };

  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { registrationIntent: true },
  });
  if (u?.registrationIntent !== RegistrationIntent.vendor) {
    return { ok: false, error: "This form is only for vendor accounts." };
  }

  const businessName = input.businessName.trim();
  const contactName = input.contactName.trim();
  const contactEmail = input.contactEmail.trim().toLowerCase();
  const contactPhone = input.contactPhone.trim();
  const cuisineCategory = input.cuisineCategory.trim();
  const posType = input.posType.trim() || "unknown";

  if (!businessName || !contactName || !contactEmail || !contactPhone || !cuisineCategory) {
    return { ok: false, error: "Please fill in all required fields." };
  }

  const slug = await uniqueVendorSlugFromName(businessName);
  const description = input.description?.trim() || null;
  const locationSummary = input.locationSummary?.trim() || null;

  const vendor = await prisma.vendor.create({
    data: {
      name: businessName,
      slug,
      description,
      contactName,
      contactEmail,
      contactPhone,
      cuisineCategory,
      posType,
      locationSummary,
      onboardingStatus: AccountOnboardingStatus.ready_for_next_step,
      vendorMemberships: {
        create: {
          userId,
          role: VendorMembershipRole.owner,
        },
      },
    },
    select: { id: true },
  });

  revalidatePath("/account");
  return { ok: true, vendorId: vendor.id };
}

export async function createPodProfile(input: {
  podName: string;
  ownerContactName: string;
  ownerContactPhone: string;
  address?: string;
  description?: string;
}): Promise<ActionResult & { podId?: string }> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Not signed in." };

  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { registrationIntent: true },
  });
  if (u?.registrationIntent !== RegistrationIntent.pod_owner) {
    return { ok: false, error: "This form is only for pod owner accounts." };
  }

  const podName = input.podName.trim();
  const ownerContactName = input.ownerContactName.trim();
  const ownerContactPhone = input.ownerContactPhone.trim();
  const address = input.address?.trim() || null;
  const description = input.description?.trim() || null;

  if (!podName || !ownerContactName || !ownerContactPhone) {
    return { ok: false, error: "Please fill in all required fields." };
  }

  const slug = await uniquePodSlugFromName(podName);

  const pod = await prisma.pod.create({
    data: {
      name: podName,
      slug,
      description,
      address,
      ownerContactName,
      ownerContactPhone,
      onboardingStatus: AccountOnboardingStatus.ready_for_next_step,
      memberships: {
        create: {
          userId,
          role: PodMembershipRole.owner,
        },
      },
    },
    select: { id: true },
  });

  revalidatePath("/account");
  return { ok: true, podId: pod.id };
}
