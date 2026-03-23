import { mennyuCanonicalMenuSchema, type MennyuCanonicalMenu } from "@/domain/menu-import/canonical.schema";

export function parseCanonicalSnapshot(snapshot: unknown): {
  menu: MennyuCanonicalMenu | null;
  parseError: string | null;
} {
  const parsed = mennyuCanonicalMenuSchema.safeParse(snapshot);
  if (parsed.success) return { menu: parsed.data, parseError: null };
  return {
    menu: null,
    parseError: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
  };
}
