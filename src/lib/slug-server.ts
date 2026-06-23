import "server-only";
import { prisma } from "@/lib/db";
import { isReservedPublicSlug } from "@/lib/reserved-slugs";
import { slugifyBase } from "@/lib/slug";

async function nextUniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>
): Promise<string> {
  let slug = base;
  let n = 0;
  while (isReservedPublicSlug(slug) || (await exists(slug))) {
    n += 1;
    slug = `${base}-${n}`;
  }
  return slug;
}

export async function uniqueVendorSlugFromName(name: string): Promise<string> {
  const base = slugifyBase(name);
  return nextUniqueSlug(base, async (slug) => Boolean(await prisma.vendor.findUnique({ where: { slug } })));
}

export async function uniquePodSlugFromName(name: string): Promise<string> {
  const base = slugifyBase(name);
  return nextUniqueSlug(base, async (slug) => Boolean(await prisma.pod.findUnique({ where: { slug } })));
}
