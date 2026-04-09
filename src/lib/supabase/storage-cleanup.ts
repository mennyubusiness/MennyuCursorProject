/**
 * Remove a prior Supabase Storage object when replacing a logo (never deletes arbitrary external URLs).
 */
import "server-only";
import { getBrandImagesBucket, getSupabaseServiceClient } from "@/lib/supabase/service";

/** Parses `/storage/v1/object/public/{bucket}/{path}` from a Supabase public URL. */
export function parseSupabasePublicStorageRef(
  publicUrl: string
): { bucket: string; objectPath: string } | null {
  try {
    const u = new URL(publicUrl);
    if (!u.hostname.endsWith("supabase.co")) return null;
    const m = u.pathname.match(/^\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
    if (!m) return null;
    return { bucket: m[1], objectPath: decodeURIComponent(m[2]) };
  } catch {
    return null;
  }
}

export async function deleteSupabasePublicObjectIfInBucket(publicUrl: string): Promise<void> {
  const ref = parseSupabasePublicStorageRef(publicUrl);
  if (!ref) return;
  const expectedBucket = getBrandImagesBucket();
  if (ref.bucket !== expectedBucket) return;

  const supabase = getSupabaseServiceClient();
  if (!supabase) return;

  const { error } = await supabase.storage.from(ref.bucket).remove([ref.objectPath]);
  if (error) {
    console.warn("[storage-cleanup] remove failed", ref.objectPath, error.message);
  }
}
