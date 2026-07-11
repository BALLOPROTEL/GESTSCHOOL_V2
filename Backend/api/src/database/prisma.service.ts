import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
    } catch (error) {
      this.logger.error(buildDatabaseConnectionHint(error));
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

function buildDatabaseConnectionHint(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("tenant/user") && message.includes("not found")) {
    return [
      "Database connection rejected by the PostgreSQL pooler.",
      "Render DATABASE_URL likely points to a Supabase pooler user or project-ref that does not exist.",
      "Check that DATABASE_URL uses the exact Supabase pooler host, password, database name and username format postgres.<project-ref>.",
      "Check that DIRECT_URL is a direct/session URL for Prisma migrations, not the transaction pooler."
    ].join(" ");
  }

  if (message.includes("Can't reach database server") || message.includes("ENOTFOUND")) {
    return [
      "Database server is unreachable from the API runtime.",
      "Check Render DATABASE_URL/DIRECT_URL host, port, SSL requirements and database provider status."
    ].join(" ");
  }

  return "Unable to initialize Prisma database connection. Check DATABASE_URL and DIRECT_URL.";
}
