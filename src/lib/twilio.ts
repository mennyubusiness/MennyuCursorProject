import twilio from "twilio";
import { env } from "./env";

export const twilioClient =
  env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN
    ? twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN)
    : null;

export const twilioPhoneNumber = env.TWILIO_PHONE_NUMBER ?? null;
