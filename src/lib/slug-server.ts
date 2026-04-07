import "server-only";
import { prisma } from "@/lib/db";
import { slugifyBase } from "@/lib/slug";

export async function uniqueVendorSlugFromName(name: string): Promise<string> {
  let base = slugifyBase(name);
  let slug = base;
  let n = 0;
  while (await prisma.vendor.findUnique({ where: { slug } })) {
    n += 1;
    slug = `${base}-${n}`;
  }
  return slug;
}

export async function uniquePodSlugFromName(name: string): Promise<string> {
  let base = slugifyBase(name);
  let slug = base;
  let n = 0;
  while (await prisma.pod.findUnique({ where: { slug } })) {
    n += 1;
    slug = `${base}-${n}`;
  }
  return slug;
}
