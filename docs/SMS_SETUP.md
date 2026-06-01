# Twilio SMS setup (Open Order)

Transactional SMS for phone verification, order confirmation, status updates, pickup-ready alerts, cancellations, and order issues. **No marketing SMS.**

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TWILIO_ACCOUNT_SID` | `SMS_MODE=twilio` | Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | `SMS_MODE=twilio` | Twilio Auth Token |
| `TWILIO_MESSAGING_SERVICE_SID` | `SMS_MODE=twilio` | **Primary send path** — Messaging Service SID |
| `TWILIO_STATUS_CALLBACK_URL` | Optional | Delivery status webhook (default: `{PUBLIC_APP_URL}/api/twilio/sms-status`) |
| `SMS_MODE` | Recommended | `log` (safe default), `twilio` (live), `disabled` |
| `PUBLIC_APP_URL` | Production | Public https origin for status callbacks |
| `NEXT_PUBLIC_APP_URL` | Optional | Client-readable origin alias |

Legacy (used when `SMS_MODE` is unset): `SMS_ENABLED`, `SMS_DRY_RUN`, `SMS_LOG_ONLY`.

## Twilio Console URLs (A2P / Messaging Service)

Configure these on your **Messaging Service** (and/or inbound phone number):

| Twilio field | URL |
|--------------|-----|
| **A message comes in** (inbound webhook) | `https://<your-domain>/api/twilio/inbound-sms` |
| **Status callback URL** (outbound delivery) | `https://<your-domain>/api/twilio/sms-status` |

Or set `TWILIO_STATUS_CALLBACK_URL=https://<your-domain>/api/twilio/sms-status` — outbound sends also pass this on each `messages.create`.

Inbound webhook handles **STOP**, **START**, **HELP**, and other replies with TwiML (TCPA). Opt-outs are stored in `SmsOptOut`.

## Twilio sender verification

Live sends (`SMS_MODE=twilio`) require a verified **Messaging Service** in Twilio. US carriers require A2P 10DLC or toll-free verification. Until approved, keep `SMS_MODE=log` — attempts are recorded in `SmsMessageLog` without calling Twilio.

## Developer checklist

1. Copy `.env.example` → `.env.local`; set `SMS_MODE=log` for local dev.
2. Run migration: `npx prisma migrate deploy`.
3. Set Twilio credentials + `TWILIO_MESSAGING_SERVICE_SID`.
4. Configure inbound + status webhooks in Twilio Console (see URLs above).
5. For live send: `SMS_MODE=twilio` and verified Messaging Service.
6. Trigger paths: OTP send, payment (`ORDER_RECEIVED`), vendor **preparing**, vendor **ready**, cancellation, order issue.
7. Check `SmsMessageLog` and Twilio Messaging logs.
8. Reply **STOP** to a test message — confirm `SmsOptOut` row and TwiML reply.

## Event types (`SmsMessageLog.eventType`)

- `PHONE_VERIFICATION`
- `ORDER_RECEIVED`
- `ORDER_PREPARING`
- `ORDER_READY`
- `ORDER_CANCELLED`
- `ORDER_ISSUE`

## Code entry points

- `src/services/sms.service.ts` — centralized send + templates
- `src/services/customer-order-notification.service.ts` — order milestones
- `src/services/customer-phone-otp.service.ts` — verification codes
- `src/app/api/twilio/inbound-sms/route.ts` — inbound STOP/START/HELP
- `src/app/api/twilio/sms-status/route.ts` — delivery status callbacks
- `src/lib/twilio.ts` — Twilio REST client
- `src/lib/phone.ts` — US E.164 normalization
