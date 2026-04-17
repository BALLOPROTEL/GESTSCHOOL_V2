import type { PrismaClient } from "@prisma/client";

export type RequiredSchema = Record<string, string[]>;

export type SchemaCompatibilityReport = {
  isCompatible: boolean;
  presentTables: string[];
  missingTables: string[];
  missingColumns: Array<{ table: string; columns: string[] }>;
};

type InformationSchemaColumn = {
  table_name: string;
  column_name: string;
};

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export async function inspectRequiredSchema(
  prisma: PrismaClient,
  required: RequiredSchema
): Promise<SchemaCompatibilityReport> {
  const requiredTables = Object.keys(required).sort();
  if (requiredTables.length === 0) {
    return { isCompatible: true, presentTables: [], missingTables: [], missingColumns: [] };
  }

  const tableList = requiredTables.map(sqlString).join(", ");
  const rows = await prisma.$queryRawUnsafe<InformationSchemaColumn[]>(
    `select table_name, column_name
     from information_schema.columns
     where table_schema = 'public'
       and table_name in (${tableList})
     order by table_name, column_name`
  );

  const columnsByTable = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!columnsByTable.has(row.table_name)) {
      columnsByTable.set(row.table_name, new Set());
    }
    columnsByTable.get(row.table_name)?.add(row.column_name);
  }

  const presentTables = [...columnsByTable.keys()].sort();
  const missingTables = requiredTables.filter((table) => !columnsByTable.has(table));
  const missingColumns = requiredTables
    .filter((table) => columnsByTable.has(table))
    .map((table) => {
      const presentColumns = columnsByTable.get(table) ?? new Set<string>();
      return {
        table,
        columns: required[table].filter((column) => !presentColumns.has(column))
      };
    })
    .filter((row) => row.columns.length > 0);

  return {
    isCompatible: missingTables.length === 0 && missingColumns.length === 0,
    presentTables,
    missingTables,
    missingColumns
  };
}
