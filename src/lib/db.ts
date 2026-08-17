import { PrismaClient } from "@prisma/client";

// Singleton, damit Hot-Reload im Dev-Modus keine Verbindungs-Leaks erzeugt.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
