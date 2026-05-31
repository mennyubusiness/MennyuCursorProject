/**
 * Transactional email (password recovery). Resend in production; log-only in development by default.
 */
import "server-only";

import { env } from "@/lib/env";
import {
  emailOperationalError,
  isEmailDryRun,
  isEmailEnabled,
  isEmailLogOnly,
  shouldSendViaResend,
} from "@/lib/email/email-config";

export type SendTransactionalEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  eventType: string;
};

export type SendTransactionalEmailResult = {
  status: "sent" | "skipped" | "failed" | "dry_run" | "log_only";
  providerMessageId: string | null;
  failureMessage: string | null;
};

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

async function sendViaResend(input: SendTransactionalEmailInput): Promise<SendTransactionalEmailResult> {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.EMAIL_FROM?.trim();
  if (!apiKey || !from) {
    return {
      status: "failed",
      providerMessageId: null,
      failureMessage: "Email provider not configured.",
    };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html ?? undefined,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return {
      status: "failed",
      providerMessageId: null,
      failureMessage: `Resend error ${res.status}: ${body.slice(0, 200)}`,
    };
  }

  const json = (await res.json().catch(() => null)) as { id?: string } | null;
  return {
    status: "sent",
    providerMessageId: json?.id ?? null,
    failureMessage: null,
  };
}

export async function sendTransactionalEmail(
  input: SendTransactionalEmailInput
): Promise<SendTransactionalEmailResult> {
  if (!isEmailEnabled()) {
    return { status: "skipped", providerMessageId: null, failureMessage: null };
  }

  const operationalError = emailOperationalError();
  if (operationalError && !isEmailDryRun() && !isEmailLogOnly()) {
    console.error("[email]", input.eventType, operationalError, { to: maskEmail(input.to) });
    return { status: "failed", providerMessageId: null, failureMessage: operationalError };
  }

  if (isEmailLogOnly() || isEmailDryRun() || !shouldSendViaResend()) {
    console.info("[email]", input.eventType, {
      to: maskEmail(input.to),
      subject: input.subject,
      mode: isEmailLogOnly() ? "log_only" : "dry_run",
      preview: input.text.slice(0, 240),
    });
    return {
      status: isEmailLogOnly() ? "log_only" : "dry_run",
      providerMessageId: null,
      failureMessage: null,
    };
  }

  return sendViaResend(input);
}
