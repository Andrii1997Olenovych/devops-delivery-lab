import { randomUUID } from 'node:crypto';

import { Redis } from 'ioredis';
import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import type { Task } from '../../src/domain/task.js';
import { PostgresTaskRepository } from '../../src/infra/postgres-task-repository.js';
import { RedisTaskCache } from '../../src/infra/redis-task-cache.js';

const databaseUrl = process.env.DATABASE_URL;
const redisUrl = process.env.REDIS_URL;
const canRunIntegration = databaseUrl !== undefined && redisUrl !== undefined;
const pool = new Pool({ connectionString: databaseUrl ?? 'postgresql://localhost:1/not-used' });
const redis = new Redis(redisUrl ?? 'redis://localhost:1', { lazyConnect: true });

describe.runIf(canRunIntegration)('PostgreSQL and Redis integration', () => {
  const repository = new PostgresTaskRepository(pool);
  const cache = new RedisTaskCache(redis);

  beforeAll(async () => {
    await redis.connect();
    await pool.query('TRUNCATE TABLE tasks');
  });

  afterEach(async () => {
    await Promise.all([pool.query('TRUNCATE TABLE tasks'), redis.flushdb()]);
  });

  afterAll(async () => {
    await Promise.all([pool.end(), redis.quit()]);
  });

  it('persists tasks in PostgreSQL and stores an expiring list in Redis', async () => {
    const task: Task = {
      id: randomUUID(),
      title: 'Exercise a real dependency',
      status: 'todo',
      createdAt: '2026-08-27T08:00:00.000Z',
      updatedAt: '2026-08-27T08:00:00.000Z',
    };

    await expect(repository.create(task)).resolves.toEqual(task);
    await expect(repository.list()).resolves.toEqual([task]);

    await cache.set('tasks:list:v1', JSON.stringify([task]), 30);
    await expect(cache.get('tasks:list:v1')).resolves.toBe(JSON.stringify([task]));
    await expect(cache.healthCheck()).resolves.toBe(true);
  });
});
