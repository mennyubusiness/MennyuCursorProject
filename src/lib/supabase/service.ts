/**
 * Supabase admin client for Storage (server-only). Optional when env is unset.
 */
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

let cached: SupabaseClient | null | undefined;

export function getSupabaseServiceClient(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    cached = null;
    return null;
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export function getBrandImagesBucket(): string {
  return env.SUPABASE_STORAGE_BUCKET?.trim() || "mennyu-assets";
}
