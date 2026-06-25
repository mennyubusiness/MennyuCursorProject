import "server-only";

import { sendTransactionalEmail } from "@/lib/email/email.service";

export async function sendPodVendorInviteEmail(input: {
  to: string;
  podName: string;
  vendorName: string | null;
  inviteUrl: string;
}) {
  const vendorLine = input.vendorName ? ` for ${input.vendorName}` : "";
  const subject = `You've been invited to join ${input.podName} on Open Order`;

  const text = [
    `You've been invited to join ${input.podName} on Open Order${vendorLine}.`,
    "",
    "Open Order lets food carts at the same pod accept pickup orders through one shared customer checkout.",
    "",
    "Create or sign in to your vendor account to connect your business to this pod.",
    "",
    input.inviteUrl,
    "",
    "If you weren't expecting this invite, you can ignore this email.",
  ].join("\n");

  const html = [
    `<p>You've been invited to join <strong>${input.podName}</strong> on Open Order${vendorLine}.</p>`,
    "<p>Open Order lets food carts at the same pod accept pickup orders through one shared customer checkout.</p>",
    "<p>Create or sign in to your vendor account to connect your business to this pod.</p>",
    `<p><a href="${input.inviteUrl}">Accept invite</a></p>`,
    "<p>If you weren't expecting this invite, you can ignore this email.</p>",
  ].join("");

  return sendTransactionalEmail({
    to: input.to,
    subject,
    text,
    html,
    eventType: "pod_vendor_invite",
  });
}
