import { PrismaClient } from "@prisma/client";

type Mode = "create" | "clone";

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function assertDatabaseIdentifier(value: string, label: string): void {
  if (!/^[a-zA-Z][a-zA-Z0-9_]{0,62}$/.test(value)) {
    throw new Error(`${label} must be a safe PostgreSQL identifier.`);
  }
}

function quoteIdentifier(value: string): string {
  assertDatabaseIdentifier(value, "Database name");
  return `"${value.replace(/"/g, "\"\"")}"`;
}

function databaseNameFromUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  return decodeURIComponent(url.pathname.replace(/^\//, ""));
}

function withDatabase(rawUrl: string, database: string): string {
  const url = new URL(rawUrl);
  url.pathname = `/${database}`;
  return url.toString();
}

async function databaseExists(prisma: PrismaClient, database: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    select exists(select 1 from pg_database where datname = ${database}) as exists
  `;
  return Boolean(rows[0]?.exists);
}

async function main(): Promise<void> {
  const mode = (getArg("mode") || "create") as Mode;
  const targetDatabase = getArg("database") || process.env.GESTSCHOOL_V2_DATABASE_NAME || "gestschool_v2";
  const defaultUrl = process.env.DATABASE_URL;

  if (!defaultUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  assertDatabaseIdentifier(targetDatabase, "Target database");

  const sourceDatabase = getArg("source") || databaseNameFromUrl(defaultUrl);
  assertDatabaseIdentifier(sourceDatabase, "Source database");

  const maintenanceUrl =
    getArg("maintenance-url") ||
    process.env.POSTGRES_MAINTENANCE_URL ||
    process.env.ADMIN_DATABASE_URL ||
    withDatabase(defaultUrl, "postgres");

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: maintenanceUrl
      }
    }
  });

  try {
    const targetExists = await databaseExists(prisma, targetDatabase);
    if (targetExists) {
      console.log(
        JSON.stringify(
          {
            mode,
            targetDatabase,
            status: "ALREADY_EXISTS",
            safety: "No statement was executed because the target database already exists."
          },
          null,
          2
        )
      );
      return;
    }

    if (mode === "clone") {
      if (sourceDatabase === targetDatabase) {
        throw new Error("Clone source and target database must be different.");
      }
      const sourceExists = await databaseExists(prisma, sourceDatabase);
      if (!sourceExists) {
        throw new Error(`Source database ${sourceDatabase} does not exist.`);
      }
      await prisma.$executeRawUnsafe(
        `CREATE DATABASE ${quoteIdentifier(targetDatabase)} WITH TEMPLATE ${quoteIdentifier(sourceDatabase)}`
      );
    } else if (mode === "create") {
      await prisma.$executeRawUnsafe(`CREATE DATABASE ${quoteIdentifier(targetDatabase)}`);
    } else {
      throw new Error(`Unsupported mode ${mode}.`);
    }

    console.log(
      JSON.stringify(
        {
          mode,
          sourceDatabase: mode === "clone" ? sourceDatabase : undefined,
          targetDatabase,
          status: "CREATED",
          safety:
            "Only CREATE DATABASE was executed. No legacy table was dropped, updated, truncated, or deleted."
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
