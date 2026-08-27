import { Pool } from 'pg';
import { Redis } from 'ioredis';

import { buildApp } from './app.js';
import { readRuntimeConfig } from './config.js';
import { PostgresTaskRepository } from './infra/postgres-task-repository.js';
import { RedisTaskCache } from './infra/redis-task-cache.js';

const config = readRuntimeConfig();
const database = new Pool({
  connectionString: config.databaseUrl,
  connectionTimeoutMillis: 1_000,
  query_timeout: 1_000,
});
const redis =
  config.redisUrl === undefined
    ? undefined
    : new Redis(config.redisUrl, {
        connectTimeout: 1_000,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        retryStrategy: (attempt) => (attempt > 10 ? null : 100),
      });
const app = buildApp({
  repository: new PostgresTaskRepository(database),
  cache: redis === undefined ? undefined : new RedisTaskCache(redis),
  logger: { level: config.logLevel },
});

redis?.on('error', (error: unknown) => {
  app.log.warn({ err: error }, 'Redis connection is unavailable; using PostgreSQL directly');
});

database.on('error', (error: Error) => {
  app.log.warn(
    { err: error },
    'PostgreSQL connection was interrupted; application remains live and not ready',
  );
});

async function close(): Promise<void> {
  await app.close();
  await Promise.all([database.end(), redis?.quit()]);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void close()
      .then(() => process.exit(0))
      .catch((error: unknown) => {
        app.log.error({ err: error }, 'Failed to close application cleanly');
        process.exit(1);
      });
  });
}

try {
  await app.listen({ host: '0.0.0.0', port: config.port });
} catch (error) {
  app.log.error({ err: error }, 'Failed to start server');
  await close();
  process.exit(1);
}
