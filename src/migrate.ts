import { Pool } from 'pg';

import { readRuntimeConfig } from './config.js';
import { applyMigrations } from './migrations.js';

const config = readRuntimeConfig();
const database = new Pool({ connectionString: config.databaseUrl });

try {
  await applyMigrations(database);
  console.info('Database migrations applied');
} finally {
  await database.end();
}
