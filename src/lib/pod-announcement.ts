export const POD_ANNOUNCEMENT_MAX_LENGTH = 160;

/** Plain-text announcement: trim and strip control characters. */
export function normalizePodAnnouncementText(raw: string | undefined | null): string {
  return (raw ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
}

export function validatePodAnnouncementText(
  raw: string | undefined | null
): { ok: true; value: string } | { ok: false; error: string } {
  const value = normalizePodAnnouncementText(raw);
  if (value.length > POD_ANNOUNCEMENT_MAX_LENGTH) {
    return {
      ok: false,
      error: `Announcement must be at most ${POD_ANNOUNCEMENT_MAX_LENGTH} characters.`,
    };
  }
  return { ok: true, value };
}

export function shouldShowPodAnnouncement(
  text: string | null | undefined,
  isActive: boolean
): boolean {
  return Boolean(isActive && normalizePodAnnouncementText(text));
}

/** Returns display text only when announcement is active and non-empty. */
export function getPublicPodAnnouncementText(
  text: string | null | undefined,
  isActive: boolean
): string | null {
  if (!shouldShowPodAnnouncement(text, isActive)) return null;
  return normalizePodAnnouncementText(text);
}

/** Safe dashboard form defaults after migration or legacy rows. */
export function resolvePodDashboardAnnouncementState(
  text: string | null | undefined,
  isActive: boolean
): { initialText: string; initialIsActive: boolean } {
  const normalized = normalizePodAnnouncementText(text);
  return {
    initialText: normalized,
    initialIsActive: Boolean(isActive && normalized),
  };
}
