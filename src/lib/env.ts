/**
 * Validated environment variables (Zod).
 * Server-only: do not import from client components or any module used in the client bundle.
 */
import "server-only";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  DELIVERECT_API_URL: z.string().url().optional(),
  /** Channel name for order API path (case-sensitive). e.g. staging path: /{channelName}/order/{channelLinkId} */
  DELIVERECT_CHANNEL_NAME: z.string().optional(),
  DELIVERECT_TOKEN_URL: z.string().url().optional(),
  DELIVERECT_AUDIENCE: z.string().optional(),
  DELIVERECT_CLIENT_ID: z.string().optional(),
  DELIVERECT_CLIENT_SECRET: z.string().optional(),
  DELIVERECT_WEBHOOK_SECRET: z.string().optional(),
  /** When "mock", Deliverect submission is skipped (payload still built and audited). Use "deliverect" for live submission. */
  ROUTING_MODE: z.enum(["mock", "deliverect"]).default("mock"),
  NEXTAUTH_URL: z.string().url().optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  /** Optional. When set, admin routes require this value (query param or cookie). TODO: Replace with proper auth. */
  ADMIN_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid env:", parsed.error.flatten());
    throw new Error("Invalid environment variables");
  }
  return parsed.data;
}

export const env = loadEnv();
