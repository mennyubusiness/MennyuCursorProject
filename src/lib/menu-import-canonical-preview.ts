import { openOrderCanonicalMenuSchema, type OpenOrderCanonicalMenu } from "@/domain/menu-import/canonical.schema";

export function parseCanonicalSnapshot(snapshot: unknown): {
  menu: OpenOrderCanonicalMenu | null;
  parseError: string | null;
} {
  const parsed = openOrderCanonicalMenuSchema.safeParse(snapshot);
  if (parsed.success) return { menu: parsed.data, parseError: null };
  return {
    menu: null,
    parseError: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
  };
}
