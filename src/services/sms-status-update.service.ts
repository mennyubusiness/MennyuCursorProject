/**
 * Update SmsMessageLog from Twilio delivery status callbacks.
 */
import "server-only";

import { prisma } from "@/lib/db";

const TERMINAL_STATUSES = new Set(["delivered", "undelivered", "failed"]);

export type TwilioSmsStatusPayload = {
  messageSid: string;
  messageStatus: string;
  to?: string | null;
  from?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
};

export function mapTwilioStatusToLogStatus(twilioStatus: string): string {
  const s = twilioStatus.trim().toLowerCase();
  switch (s) {
    case "queued":
    case "accepted":
      return "queued";
    case "sent":
    case "sending":
      return "sent";
    case "delivered":
      return "delivered";
    case "undelivered":
      return "undelivered";
    case "failed":
      return "failed";
    default:
      return s || "unknown";
  }
}

export async function applyTwilioSmsStatusCallback(
  payload: TwilioSmsStatusPayload
): Promise<{ updated: boolean; logId?: string }> {
  const messageSid = payload.messageSid.trim();
  if (!messageSid) return { updated: false };

  const log = await prisma.smsMessageLog.findFirst({
    where: { providerMessageId: messageSid },
    select: { id: true, status: true },
    orderBy: { createdAt: "desc" },
  });

  if (!log) {
    console.info(
      JSON.stringify({
        event: "twilio_sms_status_orphan",
        messageSid,
        messageStatus: payload.messageStatus,
        to: payload.to,
      })
    );
    return { updated: false };
  }

  if (TERMINAL_STATUSES.has(log.status) && log.status === mapTwilioStatusToLogStatus(payload.messageStatus)) {
    return { updated: false, logId: log.id };
  }

  const nextStatus = mapTwilioStatusToLogStatus(payload.messageStatus);

  await prisma.smsMessageLog.update({
    where: { id: log.id },
    data: {
      status: nextStatus,
      errorCode: payload.errorCode ?? undefined,
      failureMessage: payload.errorMessage ?? undefined,
      ...(nextStatus === "delivered" ? { sentAt: new Date() } : {}),
    },
  });

  return { updated: true, logId: log.id };
}
