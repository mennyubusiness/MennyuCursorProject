/**
 * Prisma client singleton for Next.js.
 * Query logging is off by default; set PRISMA_LOG_QUERIES=true to enable.
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

const devLogLevels: ("query" | "error" | "warn")[] =
  process.env.PRISMA_LOG_QUERIES === "true"
    ? ["query", "error", "warn"]
    : ["error", "warn"];

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? devLogLevels : ["error"],
  });

globalForPrisma.prisma = prisma;
