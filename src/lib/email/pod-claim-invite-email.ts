import "server-only";

import { sendTransactionalEmail } from "@/lib/email/email.service";

export function sendPodClaimInviteEmail(input: {
  to: string;
  podName: string;
  address: string | null;
  inviteUrl: string;
}) {
  const locationLine = input.address
    ? `We've set up your pod and vendor menus for ${input.address}.`
    : "We've set up your pod and vendor menus.";
  const text = [
    `${input.podName} is ready on Open Order`,
    "",
    locationLine,
    "",
    "Claim your pod to manage:",
    "- pod details",
    "- vendor roster",
    "- sharing/QR tools",
    "- pod dashboard",
    "",
    input.inviteUrl,
    "",
    "This link expires in 7 days.",
  ].join("\n");
  const html = [
    `<h1>${escapeHtml(input.podName)} is ready on Open Order</h1>`,
    `<p>${escapeHtml(locationLine)}</p>`,
    "<p>Claim your pod to manage pod details, vendor roster, sharing/QR tools, and the pod dashboard.</p>",
    `<p><a href="${escapeHtml(input.inviteUrl)}">Claim pod</a></p>`,
    "<p>This link expires in 7 days.</p>",
  ].join("");

  return sendTransactionalEmail({
    to: input.to,
    subject: "Claim your Open Order pod",
    text,
    html,
    eventType: "pod_claim_invite",
    sensitiveContent: true,
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
