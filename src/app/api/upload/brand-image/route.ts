import { NextResponse } from "next/server";
import { canAccessPodDashboardLayout } from "@/lib/permissions";
import { authorizeVendorSettingsWrite } from "@/lib/server/vendor-settings-authorization";
import { getBrandImagesBucket, getSupabaseServiceClient } from "@/lib/supabase/service";
import { deleteSupabasePublicObjectIfInBucket } from "@/lib/supabase/storage-cleanup";
import { validateImageFileBuffer } from "@/lib/validate-image-upload";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Image upload is not configured. Add Supabase URL and service role key to the server environment." },
      { status: 503 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid form data." }, { status: 400 });
  }

  const scope = formData.get("scope");
  const entityId = String(formData.get("entityId") ?? "").trim();
  const file = formData.get("file");
  const previousUrlRaw = formData.get("previousUrl");

  if (scope !== "pod" && scope !== "vendor") {
    return NextResponse.json({ ok: false, error: "Invalid scope." }, { status: 400 });
  }
  if (!entityId) {
    return NextResponse.json({ ok: false, error: "Missing entity id." }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false, error: "Choose an image file to upload." }, { status: 400 });
  }

  if (scope === "pod") {
    const allowed = await canAccessPodDashboardLayout(entityId);
    if (!allowed) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 403 });
    }
  } else {
    const authz = await authorizeVendorSettingsWrite(entityId);
    if (!authz.ok) {
      return NextResponse.json({ ok: false, error: authz.error }, { status: 403 });
    }
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const validated = validateImageFileBuffer(buf);
  if (!validated.ok) {
    return NextResponse.json({ ok: false, error: validated.error }, { status: 400 });
  }

  const bucket = getBrandImagesBucket();
  const ts = Date.now();
  const objectPath =
    scope === "pod"
      ? `pods/${entityId}/logo-${ts}.${validated.value.extension}`
      : `vendors/${entityId}/logo-${ts}.${validated.value.extension}`;

  const { error: uploadError } = await supabase.storage.from(bucket).upload(objectPath, buf, {
    contentType: validated.value.contentType,
    upsert: false,
  });

  if (uploadError) {
    console.error("[upload/brand-image]", uploadError);
    return NextResponse.json(
      { ok: false, error: uploadError.message || "Upload failed. Ensure the Storage bucket exists and is writable." },
      { status: 500 }
    );
  }

  const { data: pub } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  const publicUrl = pub.publicUrl;

  if (typeof previousUrlRaw === "string" && previousUrlRaw.trim()) {
    void deleteSupabasePublicObjectIfInBucket(previousUrlRaw.trim());
  }

  return NextResponse.json({ ok: true, url: publicUrl });
}
