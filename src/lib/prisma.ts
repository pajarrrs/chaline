import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  dbInitialized: boolean | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Auto-ensure database schema columns exist in PostgreSQL without requiring PgBouncer-incompatible migrations
if (!globalForPrisma.dbInitialized) {
  globalForPrisma.dbInitialized = true;
  (async () => {
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "replyToId" TEXT;
      `);
    } catch {
      // Silently ignore if already exists or during build
    }
  })();
}
