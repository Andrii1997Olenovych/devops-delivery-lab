import { readFile } from 'node:fs/promises';

export interface MigrationClient {
  query(statement: string): Promise<unknown>;
}

export type MigrationSqlLoader = () => Promise<string>;

export async function applyMigrations(
  client: MigrationClient,
  loadSql: MigrationSqlLoader = loadTaskSchema,
): Promise<void> {
  await client.query(await loadSql());
}

async function loadTaskSchema(): Promise<string> {
  return readFile(new URL('../db/migrations/001_create_tasks.sql', import.meta.url), 'utf8');
}
