# Twilio SMS setup (Open Order)

Transactional SMS for order confirmation and status updates (future: issue notifications).

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TWILIO_ACCOUNT_SID` | Production send | Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | Production send | Twilio Auth Token |
| `TWILIO_FROM_PHONE_NUMBER` | If no Messaging Service | E.164 sender, e.g. `+15551234567` |
| `TWILIO_MESSAGING_SERVICE_SID` | Optional | Use Messaging Service instead of From |
| `TWILIO_PHONE_NUMBER` | Optional | Legacy alias for `TWILIO_FROM_PHONE_NUMBER` |
| `SMS_ENABLED` | Recommended | `true` / `false` (default: off in dev, on in production) |
| `SMS_DRY_RUN` | Recommended | `true` records `dry_run` in `SmsMessageLog` without calling Twilio |
| `SMS_LOG_ONLY` | Optional | `true` = log only, no Twilio |

## Developer checklist (manual verification)

1. Copy `.env.example` to `.env.local` and set Twilio credentials.
2. Run migration: `npx prisma migrate deploy` (or `migrate dev` locally).
3. Set `SMS_ENABLED=true`.
4. Keep `SMS_DRY_RUN=true` until you intend to send a real message.
5. When ready for a real send: `SMS_DRY_RUN=false`.
6. Place a test order (or advance an order to **ready** in dev simulator with SMS not skipped).
7. Confirm the message in the [Twilio Console](https://console.twilio.com/) → Messaging → Logs.
8. Confirm a row in `SmsMessageLog` with `status=sent` (or `dry_run` during dry run).
9. Trigger the same event again and confirm **no second** Twilio message (idempotency key).

## Current wired events

- `milestone_order_received` — after payment is first recorded (`processSuccessfulPayment`).
- `milestone_vendor_ready` — per vendor when ready in a multi-vendor order (not the final pickup).
- `milestone_final_vendor_ready` — last active vendor ready, or single-vendor ready (includes pickup code).
- `milestone_vendor_cancelled` — one vendor cancelled while the order continues.
- `milestone_order_cancelled` — whole parent order cancelled.
- `milestone_order_issue` — template + idempotency ready; wire when customer issue SMS is enabled.

Legacy parent-status SMS (`order_status_*`, `order_confirmation`) is bypassed in favor of milestones.

## Code entry points

- `src/services/customer-order-notification.service.ts` — milestone templates + evaluator
- `src/services/sms.service.ts` — `sendTransactionalSms`
- `src/lib/twilio.ts` — Twilio client
- `src/lib/phone.ts` — US E.164 normalization
