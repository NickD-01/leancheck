import { PrismaClient } from "@prisma/client";

// Audit data still lives in the legacy Prisma-managed database.
export const prisma = new PrismaClient();
