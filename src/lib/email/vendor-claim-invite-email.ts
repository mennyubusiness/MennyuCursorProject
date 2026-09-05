import "server-only";

import { sendTransactionalEmail } from "@/lib/email/email.service";

export function sendVendorClaimInviteEmail(input: {
  to: string;
  vendorName: string;
  podName: string | null;
  inviteUrl: string;
}) {
  const locationLine = input.podName
    ? `Your vendor profile and menu have been set up for ${input.podName}.`
    : "Your vendor profile and menu have been set up on Open Order.";
  const text = [
    `${input.vendorName} is ready on Open Order`,
    "",
    locationLine,
    "",
    "Claim your profile to manage your menu, hours, and business details:",
    input.inviteUrl,
    "",
    "This link expires in 7 days.",
  ].join("\n");
  const html = [
    `<h1>${escapeHtml(input.vendorName)} is ready on Open Order</h1>`,
    `<p>${escapeHtml(locationLine)}</p>`,
    "<p>Claim your profile to manage your menu, hours, and business details.</p>",
    `<p><a href="${escapeHtml(input.inviteUrl)}">Claim vendor</a></p>`,
    "<p>This link expires in 7 days.</p>",
  ].join("");

  return sendTransactionalEmail({
    to: input.to,
    subject: "Claim your Open Order vendor profile",
    text,
    html,
    eventType: "vendor_claim_invite",
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
