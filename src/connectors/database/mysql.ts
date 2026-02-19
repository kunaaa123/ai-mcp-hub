import mysql, { Pool, PoolConnection } from 'mysql2/promise';
import config from '../../config';

// ============================================================
// MySQL Database Connector
// ============================================================

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: config.database.host,
      port: config.database.port,
      user: config.database.user,
      password: config.database.password,
      database: config.database.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      timezone: '+00:00',
    });
  }
  return pool;
}

// ─── Query Execution ─────────────────────────────────────────
export async function runQuery(
  sql: string,
  params: unknown[] = []
): Promise<{ rows: unknown[]; fields: string[]; affectedRows?: number }> {
  const conn = await getPool().getConnection();
  try {
    const [rows, fields] = await conn.query(sql, params);
    const fieldNames = Array.isArray(fields)
      ? fields.map((f: any) => f.name as string)
      : [];

    return {
      rows: rows as unknown[],
      fields: fieldNames,
      affectedRows: (rows as any).affectedRows,
    };
  } finally {
    conn.release();
  }
}

// ─── Schema Inspection ───────────────────────────────────────
export async function getSchema(dbName?: string): Promise<unknown> {
  const database = dbName ?? config.database.database;
  const { rows: tables } = await runQuery(
    `SELECT TABLE_NAME, TABLE_COMMENT 
     FROM information_schema.TABLES 
     WHERE TABLE_SCHEMA = ?`,
    [database]
  );

  const schema: Record<string, unknown> = {};
  for (const table of tables as any[]) {
    const tableName = table.TABLE_NAME as string;
    const { rows: columns } = await runQuery(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY, EXTRA, COLUMN_COMMENT
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
       ORDER BY ORDINAL_POSITION`,
      [database, tableName]
    );
    schema[tableName] = {
      comment: table.TABLE_COMMENT,
      columns,
    };
  }
  return schema;
}

// ─── Auto Query Generator ────────────────────────────────────
export async function generateSelectQuery(
  tableName: string,
  filters?: Record<string, unknown>,
  limit = 50
): Promise<{ sql: string; params: unknown[] }> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      conditions.push(`\`${key}\` = ?`);
      params.push(value);
    }
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT * FROM \`${tableName}\` ${where} LIMIT ${limit}`;

  return { sql, params };
}

// ─── Migration Execution ─────────────────────────────────────
export async function executeMigration(migrationSql: string): Promise<{
  success: boolean;
  message: string;
}> {
  const statements = migrationSql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  try {
    const conn = await getPool().getConnection();
    await conn.beginTransaction();
    try {
      for (const stmt of statements) {
        await conn.query(stmt);
      }
      await conn.commit();
      conn.release();
      return { success: true, message: `Executed ${statements.length} statements` };
    } catch (err) {
      await conn.rollback();
      conn.release();
      throw err;
    }
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// ─── Data Validation ─────────────────────────────────────────
export async function validateTableExists(tableName: string): Promise<boolean> {
  const { rows } = await runQuery(
    `SELECT COUNT(*) as cnt FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [config.database.database, tableName]
  );
  return ((rows[0] as any).cnt as number) > 0;
}

export async function getTableRowCount(tableName: string): Promise<number> {
  const { rows } = await runQuery(`SELECT COUNT(*) as cnt FROM \`${tableName}\``);
  return (rows[0] as any).cnt as number;
}
