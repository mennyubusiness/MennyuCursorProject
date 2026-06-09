import { normalizeGroupOrderJoinCode } from "@/lib/group-order-join-code";

/** Participant join path — code only; never includes joinToken or session privileges. */
export function buildGroupOrderJoinPath(joinCode: string): string {
  const code = normalizeGroupOrderJoinCode(joinCode);
  return `/group-order/join?code=${encodeURIComponent(code)}`;
}

export function buildGroupOrderJoinAbsoluteUrl(origin: string, joinCode: string): string {
  const o = origin.replace(/\/$/, "");
  return `${o}${buildGroupOrderJoinPath(joinCode)}`;
}

export function buildGroupOrderShareText(podName: string, joinCode: string): string {
  const code = normalizeGroupOrderJoinCode(joinCode);
  return `Join my Open Order group order at ${podName}. Code: ${code}`;
}
