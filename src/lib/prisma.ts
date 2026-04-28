import { PrismaClient } from "@prisma/client";

/**
 * Singleton lazy do PrismaClient — evita criar múltiplas conexões em hot-reload
 * dev e em serverless cold-start.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["warn", "error"] : ["query", "warn", "error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
