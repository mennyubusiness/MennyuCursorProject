export const ADMIN_AUDIT_TARGET = {
  user: "user",
  vendor: "vendor",
  pod: "pod",
  invite: "invite",
  vendorPodMembership: "vendorPodMembership",
  slug: "slug",
} as const;

export type AdminAuditTargetType = (typeof ADMIN_AUDIT_TARGET)[keyof typeof ADMIN_AUDIT_TARGET];

export const ADMIN_AUDIT_ACTION = {
  USER_DISABLED: "USER_DISABLED",
  USER_REENABLED: "USER_REENABLED",
  USER_PHONE_CLEARED: "USER_PHONE_CLEARED",
  USER_EMAIL_MARKED_VERIFIED: "USER_EMAIL_MARKED_VERIFIED",
  USER_PHONE_MARKED_VERIFIED: "USER_PHONE_MARKED_VERIFIED",
  USER_SESSION_INVALIDATED: "USER_SESSION_INVALIDATED",
  USER_PASSWORD_RESET_SENT: "USER_PASSWORD_RESET_SENT",
  VENDOR_ACCESS_ADDED: "VENDOR_ACCESS_ADDED",
  VENDOR_ACCESS_REMOVED: "VENDOR_ACCESS_REMOVED",
  VENDOR_OWNER_TRANSFERRED: "VENDOR_OWNER_TRANSFERRED",
  POD_OWNER_ACCESS_ADDED: "POD_OWNER_ACCESS_ADDED",
  POD_OWNER_ACCESS_REMOVED: "POD_OWNER_ACCESS_REMOVED",
  POD_OWNER_TRANSFERRED: "POD_OWNER_TRANSFERRED",
  VENDOR_ATTACHED_TO_POD: "VENDOR_ATTACHED_TO_POD",
  VENDOR_DETACHED_FROM_POD: "VENDOR_DETACHED_FROM_POD",
  INVITE_REVOKED: "INVITE_REVOKED",
  INVITE_RESENT: "INVITE_RESENT",
  INVITE_LINK_REGENERATED: "INVITE_LINK_REGENERATED",
  INVITE_ATTACHMENT_REPAIRED: "INVITE_ATTACHMENT_REPAIRED",
  VENDOR_ORDERING_PAUSED: "VENDOR_ORDERING_PAUSED",
  VENDOR_ORDERING_UNPAUSED: "VENDOR_ORDERING_UNPAUSED",
  VENDOR_HIDDEN: "VENDOR_HIDDEN",
  VENDOR_SHOWN: "VENDOR_SHOWN",
  VENDOR_PUBLIC_PROFILE_UPDATED: "VENDOR_PUBLIC_PROFILE_UPDATED",
  VENDOR_MOVED_TO_POD: "VENDOR_MOVED_TO_POD",
  VENDOR_MENU_REFRESH_REQUESTED: "VENDOR_MENU_REFRESH_REQUESTED",
  VENDOR_READINESS_RECHECKED: "VENDOR_READINESS_RECHECKED",
  POD_ORDERING_PAUSED: "POD_ORDERING_PAUSED",
  POD_ORDERING_UNPAUSED: "POD_ORDERING_UNPAUSED",
  POD_HIDDEN: "POD_HIDDEN",
  POD_SHOWN: "POD_SHOWN",
  POD_PUBLIC_PROFILE_UPDATED: "POD_PUBLIC_PROFILE_UPDATED",
  POD_VENDOR_ATTACHED: "POD_VENDOR_ATTACHED",
  POD_VENDOR_DETACHED: "POD_VENDOR_DETACHED",
  POD_READINESS_RECHECKED: "POD_READINESS_RECHECKED",
  SLUG_CHANGED: "SLUG_CHANGED",
  SLUG_REDIRECT_CREATED: "SLUG_REDIRECT_CREATED",
  SLUG_RESTORED: "SLUG_RESTORED",
  QR_REGENERATED: "QR_REGENERATED",
} as const;

export type AdminAuditActionType = (typeof ADMIN_AUDIT_ACTION)[keyof typeof ADMIN_AUDIT_ACTION];

export function normalizeAdminReason(reason: string | null | undefined): string | null {
  const trimmed = reason?.trim() ?? "";
  if (trimmed.length < 3) return null;
  if (trimmed.length > 2000) return trimmed.slice(0, 2000);
  return trimmed;
}

export function requireAdminReason(reason: string | null | undefined): { ok: true; reason: string } | { ok: false; error: string } {
  const normalized = normalizeAdminReason(reason);
  if (!normalized) {
    return { ok: false, error: "A reason of at least 3 characters is required." };
  }
  return { ok: true, reason: normalized };
}

export function serializeAuditValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
