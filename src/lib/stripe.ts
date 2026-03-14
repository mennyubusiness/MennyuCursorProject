import Stripe from "stripe";
import { env } from "./env";

export const stripe =
  env.STRIPE_SECRET_KEY ?
    new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2024-11-20.acacia" })
  : (null as unknown as Stripe);
