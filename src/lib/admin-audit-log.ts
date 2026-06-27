export const ADMIN_AUDIT_TARGET = {
  user: "user",
  vendor: "vendor",
  pod: "pod",
  invite: "invite",
  vendorPodMembership: "vendorPodMembership",
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
